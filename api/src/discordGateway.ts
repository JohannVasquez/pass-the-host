import { DurableObject } from 'cloudflare:workers'
import { verify } from 'hono/jwt'
import { getPrisma } from './db'
import { findLink } from './discord'
import { RateLimiter, toRelayPayload, type GuildNames } from './discordFormat'
import type { AppEnv } from './env'

const GATEWAY_URL = 'https://gateway.discord.gg/?v=10&encoding=json'
// GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
const INTENTS = 33281
const IDLE_CLOSE_MS = 60_000
const HELLO_TIMEOUT_MS = 10_000
const MIN_RETRY_MS = 5_000
// Authentication failed, bad/disallowed intents, bad shard or API version: retrying cannot help
const FATAL_CODES = new Set([4004, 4010, 4011, 4012, 4013, 4014])

type Client = { ws: WebSocket; linkId?: string; guildId?: string; channelId?: string }
type Timer = ReturnType<typeof setTimeout>

const helloFrame = (raw: string): { token: string; linkId: string; secret: string } | null => {
  try {
    const m = JSON.parse(raw)
    if (m?.type === 'hello' && typeof m.token === 'string' && typeof m.linkId === 'string' && typeof m.secret === 'string')
      return m
  } catch {
    // not JSON: handled as unauthorized by the caller
  }
  return null
}

// One instance (idFromName('gateway')) serves every app socket and shares ONE Discord Gateway connection
export class DiscordGateway extends DurableObject<AppEnv['Bindings']> {
  private clients = new Set<Client>()
  private limiter = new RateLimiter(5, 5000)
  // ponytail: caches every guild the bot is in; trim to guilds with live clients if memory ever matters
  private guilds = new Map<string, GuildNames>()

  private gw: WebSocket | null = null
  private connecting = false
  private sessionId: string | null = null
  private resumeUrl: string | null = null
  private seq: number | null = null
  private acked = true
  private lastConnectAt = 0
  private heartbeat: Timer | null = null
  private retry: Timer | null = null
  private idle: Timer | null = null

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/refresh') {
      const body = (await request.json().catch(() => null)) as { linkId?: string } | null
      if (body?.linkId) await this.refreshLink(body.linkId)
      return new Response(null, { status: 204 })
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected WebSocket', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.acceptClient(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ---- app sockets ----

  private acceptClient(ws: WebSocket): void {
    ws.accept()
    const client: Client = { ws }
    const timeout = setTimeout(() => {
      if (!client.linkId) this.reject(client, 'unauthorized')
    }, HELLO_TIMEOUT_MS)
    ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      if (client.linkId) {
        if (raw.includes('"ping"')) this.send(ws, { type: 'pong' })
        return
      }
      clearTimeout(timeout)
      void this.hello(client, raw).catch(() => this.reject(client, 'unauthorized'))
    })
    const gone = (): void => {
      clearTimeout(timeout)
      this.clients.delete(client)
      this.scheduleIdleClose()
    }
    ws.addEventListener('close', gone)
    ws.addEventListener('error', gone)
  }

  private async hello(client: Client, raw: string): Promise<void> {
    const frame = helloFrame(raw)
    if (!frame) return this.reject(client, 'unauthorized')
    try {
      await verify(frame.token, this.env.JWT_SECRET, 'HS256')
    } catch {
      return this.reject(client, 'unauthorized')
    }
    const link = await findLink(this.env.DB, frame.linkId, frame.secret)
    if (!link) return this.reject(client, 'invalid_link')
    // Nothing to relay until the bot is in a guild and a channel is picked
    if (!link.guildId || !link.channelId) return this.reject(client, 'link_pending')
    client.linkId = link.id
    client.guildId = link.guildId
    client.channelId = link.channelId
    this.clients.add(client)
    if (this.idle) clearTimeout(this.idle)
    this.idle = null
    this.send(client.ws, { type: 'ready', channelName: link.channelName })
    this.ensureConnected()
  }

  private reject(client: Client, code: string): void {
    this.send(client.ws, { type: 'error', code })
    try {
      client.ws.close(4000, code)
    } catch {
      // already closed
    }
    this.clients.delete(client)
    this.scheduleIdleClose()
  }

  private send(ws: WebSocket, data: unknown): void {
    try {
      ws.send(JSON.stringify(data))
    } catch {
      // the socket is closing; its close handler cleans up
    }
  }

  // Link changed (PUT/DELETE): sockets of that link pick up the new channel or are dropped
  private async refreshLink(linkId: string): Promise<void> {
    const mine = [...this.clients].filter((c) => c.linkId === linkId)
    if (!mine.length) return
    const link = await getPrisma(this.env.DB).discordLink.findUnique({ where: { id: linkId } })
    for (const client of mine) {
      if (!link) this.reject(client, 'invalid_link')
      else {
        client.guildId = link.guildId
        client.channelId = link.channelId
      }
    }
  }

  private scheduleIdleClose(): void {
    if (this.clients.size || this.idle) return
    this.idle = setTimeout(() => {
      this.idle = null
      if (this.clients.size) return
      this.disconnect()
      // A clean close ends the Discord session, so the next connect identifies from scratch
      this.sessionId = this.resumeUrl = this.seq = null
    }, IDLE_CLOSE_MS)
  }

  // ---- Discord Gateway ----

  private ensureConnected(): void {
    if (this.gw || this.connecting || this.retry) return
    const wait = Math.max(0, MIN_RETRY_MS - (Date.now() - this.lastConnectAt))
    if (wait) this.scheduleConnect(wait)
    else void this.openGateway()
  }

  private scheduleConnect(ms: number): void {
    if (this.retry) return
    this.retry = setTimeout(() => {
      this.retry = null
      if (this.clients.size) void this.openGateway()
    }, ms)
  }

  private disconnect(code = 1000): void {
    if (this.heartbeat) clearTimeout(this.heartbeat)
    this.heartbeat = null
    const ws = this.gw
    this.gw = null
    try {
      ws?.close(code)
    } catch {
      // already closed
    }
  }

  private async openGateway(): Promise<void> {
    if (this.gw || this.connecting) return
    this.connecting = true
    this.lastConnectAt = Date.now()
    try {
      const base = this.sessionId && this.resumeUrl ? this.resumeUrl.replace(/^wss:/, 'https:') : 'https://gateway.discord.gg'
      const url = this.sessionId && this.resumeUrl ? `${base}/?v=10&encoding=json` : GATEWAY_URL
      const resp = await fetch(url, { headers: { Upgrade: 'websocket' } })
      const ws = resp.webSocket
      if (!ws) throw new Error(`gateway upgrade failed (${resp.status})`)
      ws.accept()
      this.gw = ws
      this.acked = true
      ws.addEventListener('message', (e) => {
        if (ws === this.gw && typeof e.data === 'string') this.onFrame(ws, e.data)
      })
      ws.addEventListener('close', (e) => this.onGatewayClose(ws, e.code))
      ws.addEventListener('error', () => this.onGatewayClose(ws, 0))
    } catch (err) {
      console.error('discord gateway connect failed', (err as Error).message)
      this.scheduleConnect(MIN_RETRY_MS)
    } finally {
      this.connecting = false
    }
  }

  private onGatewayClose(ws: WebSocket, code: number): void {
    if (ws !== this.gw) return
    this.disconnect(1000)
    if (FATAL_CODES.has(code)) {
      console.error('discord gateway closed fatally', code)
      this.sessionId = this.resumeUrl = this.seq = null
      for (const c of this.clients) this.send(c.ws, { type: 'error', code: 'bot_unavailable' })
      // No retry until a new client says hello
      return
    }
    if (code === 4007 || code === 4009) this.sessionId = this.resumeUrl = this.seq = null
    if (this.clients.size) this.scheduleConnect(1000 + Math.random() * 4000)
  }

  private sendGw(payload: unknown): void {
    try {
      this.gw?.send(JSON.stringify(payload))
    } catch {
      // the close handler will reconnect
    }
  }

  private beat(): void {
    if (!this.gw) return
    if (!this.acked) {
      // Zombie connection: drop it and resume
      this.disconnect(4000)
      if (this.clients.size) this.scheduleConnect(1000 + Math.random() * 4000)
      return
    }
    this.acked = false
    this.sendGw({ op: 1, d: this.seq })
  }

  private startHeartbeat(interval: number): void {
    const loop = (): void => {
      this.heartbeat = setTimeout(() => {
        this.beat()
        if (this.gw) loop()
      }, interval)
    }
    // The first beat is jittered so reconnect storms do not line up
    this.heartbeat = setTimeout(() => {
      this.beat()
      if (this.gw) loop()
    }, interval * Math.random())
  }

  private onFrame(ws: WebSocket, raw: string): void {
    let frame: { op: number; d?: any; s?: number | null; t?: string }
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof frame.s === 'number') this.seq = frame.s
    switch (frame.op) {
      case 10:
        this.startHeartbeat(frame.d.heartbeat_interval)
        if (this.sessionId) this.sendGw({ op: 6, d: { token: this.env.DISCORD_BOT_TOKEN, session_id: this.sessionId, seq: this.seq } })
        else
          this.sendGw({
            op: 2,
            d: {
              token: this.env.DISCORD_BOT_TOKEN,
              intents: INTENTS,
              properties: { os: 'linux', browser: 'pass-the-host', device: 'pass-the-host' }
            }
          })
        break
      case 11:
        this.acked = true
        break
      case 1:
        this.sendGw({ op: 1, d: this.seq })
        break
      case 7:
        this.reconnectSoon(ws, true)
        break
      case 9:
        this.reconnectSoon(ws, frame.d === true)
        break
      case 0:
        this.onDispatch(frame.t ?? '', frame.d)
        break
    }
  }

  // Reconnect and resume (or re-identify) after a short random pause, as Discord asks for op 9
  private reconnectSoon(ws: WebSocket, resume: boolean): void {
    if (ws !== this.gw) return
    if (!resume) this.sessionId = this.resumeUrl = this.seq = null
    this.disconnect(4000)
    if (this.clients.size) this.scheduleConnect(1000 + Math.random() * 4000)
  }

  private names(guildId: string): GuildNames {
    let names = this.guilds.get(guildId)
    if (!names) this.guilds.set(guildId, (names = { roles: new Map(), channels: new Map() }))
    return names
  }

  private onDispatch(type: string, d: any): void {
    switch (type) {
      case 'READY':
        this.sessionId = d.session_id
        this.resumeUrl = d.resume_gateway_url
        break
      case 'GUILD_CREATE': {
        const names = this.names(d.id)
        names.roles = new Map((d.roles ?? []).map((r: { id: string; name: string }) => [r.id, r.name]))
        names.channels = new Map((d.channels ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
        break
      }
      case 'GUILD_DELETE':
        // `unavailable` means an outage, not that the bot was removed
        if (d.unavailable) break
        this.guilds.delete(d.id)
        for (const c of [...this.clients]) if (c.guildId === d.id) this.reject(c, 'bot_removed')
        break
      case 'CHANNEL_CREATE':
      case 'CHANNEL_UPDATE':
        if (d.guild_id) this.names(d.guild_id).channels.set(d.id, d.name)
        break
      case 'CHANNEL_DELETE':
        if (d.guild_id) this.names(d.guild_id).channels.delete(d.id)
        break
      case 'GUILD_ROLE_CREATE':
      case 'GUILD_ROLE_UPDATE':
        this.names(d.guild_id).roles.set(d.role.id, d.role.name)
        break
      case 'GUILD_ROLE_DELETE':
        this.names(d.guild_id).roles.delete(d.role_id)
        break
      case 'MESSAGE_CREATE':
        this.relay(d)
        break
    }
  }

  private relay(d: { guild_id?: string; channel_id?: string }): void {
    const targets = [...this.clients].filter((c) => c.guildId === d.guild_id && c.channelId === d.channel_id)
    if (!targets.length) return
    const payload = toRelayPayload(d as Parameters<typeof toRelayPayload>[0], this.names(d.guild_id!))
    if (!payload) return
    // The limit is per link, however many friends are connected to it
    const allowed = new Set<string>()
    for (const linkId of new Set(targets.map((c) => c.linkId!))) if (this.limiter.allow(linkId)) allowed.add(linkId)
    for (const c of targets) if (allowed.has(c.linkId!)) this.send(c.ws, payload)
  }
}
