import { DurableObject } from 'cloudflare:workers'
import type { AppEnv } from './env'

// One instance per room (idFromName(groupId)): presence + signaling relay, replacing the room's Ably channel.
// Sockets hibernate between messages, so an idle room costs nothing.

type Member = { clientId: string; data: unknown }
type Attachment = { clientId: string; since: number; connKey?: string; data?: unknown }
type Lingering = Member & { until: number }

const MAX_FRAME = 64 * 1024
const MAX_NAME = 64
// A socket that drops keeps its presence this long, so a quick reconnect isn't seen as leaving (like Ably)
const LINGER_MS = 15_000
// Clients ping every 5 s and the runtime answers without waking us; a socket silent this long is dead
const STALE_MS = 20_000
// The sweep only runs while someone hosts or a presence lingers, so quiet rooms never wake up
const SWEEP_MS = 10_000
/** Close code for a member removed from the room: the app must not reconnect. */
export const KICKED = 4403

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isHosting = (data: unknown): boolean => isObject(data) && data.hosting === true

const send = (ws: WebSocket, frame: string): void => {
  try {
    ws.send(frame)
  } catch {
    // closing: its close handler cleans up
  }
}

export class RoomHub extends DurableObject<AppEnv['Bindings']> {
  constructor(ctx: DurableObjectState, env: AppEnv['Bindings']) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  // The Worker checked the ticket and passes the verified user id
  async fetch(request: Request): Promise<Response> {
    const clientId = request.headers.get('X-User-Id')
    if (!clientId) return new Response('Missing user', { status: 400 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server, [clientId])
    server.serializeAttachment({ clientId, since: Date.now() } satisfies Attachment)
    server.send(JSON.stringify({ t: 'hello', clientId }))
    server.send(JSON.stringify({ t: 'presence', members: await this.members() }))
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_FRAME) return
    let m: { t?: unknown; name?: unknown; data?: unknown; connKey?: unknown }
    try {
      m = JSON.parse(raw)
    } catch {
      return
    }
    const me = ws.deserializeAttachment() as Attachment
    if (m.t === 'presence' && isObject(m.data) && typeof m.connKey === 'string' && m.connKey.length <= MAX_NAME) {
      me.data = m.data
      me.connKey = m.connKey
      ws.serializeAttachment(me)
      // Reconnected within the grace period: the live socket replaces the lingering entry
      await this.ctx.storage.delete(`linger:${m.connKey}`)
      await this.changed()
    } else if (m.t === 'leave') {
      if (me.data === undefined) return
      me.data = undefined
      ws.serializeAttachment(me)
      await this.changed()
    } else if (m.t === 'pub' && typeof m.name === 'string' && m.name.length <= MAX_NAME) {
      // Messages addressed to someone (offers, answers, diagnostics) only reach that user's sockets,
      // so SDPs (which carry IP addresses) aren't broadcast to the whole room like on Ably
      const to = isObject(m.data) && typeof m.data.to === 'string' ? m.data.to : undefined
      const frame = JSON.stringify({ t: 'msg', name: m.name, clientId: me.clientId, data: m.data })
      for (const peer of this.ctx.getWebSockets(to)) if (peer !== ws) send(peer, frame)
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // 1000 = the app left on purpose; anything else may be a blip worth waiting for
    await this.gone(ws, code !== 1000 && code !== KICKED)
    try {
      ws.close(1000, 'bye')
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.gone(ws, true)
  }

  /** Disconnects a removed member, or everyone when the room is deleted. */
  async kick(userId?: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets(userId)) {
      this.clear(ws)
      try {
        ws.close(KICKED, 'removed')
      } catch {
        // already closed
      }
    }
    if (userId === undefined) await this.ctx.storage.deleteAll()
    else
      for (const [key, entry] of await this.ctx.storage.list<Lingering>({ prefix: 'linger:' }))
        if (entry.clientId === userId) await this.ctx.storage.delete(key)
    await this.changed()
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    let dirty = false
    for (const [key, entry] of await this.ctx.storage.list<Lingering>({ prefix: 'linger:' }))
      if (entry.until <= now) {
        await this.ctx.storage.delete(key)
        dirty = true
      }
    for (const ws of this.ctx.getWebSockets()) {
      const me = ws.deserializeAttachment() as Attachment
      const last = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? me.since
      if (now - last <= STALE_MS) continue
      // Already past any grace period: drop it without lingering
      dirty = this.clear(ws) || dirty
      try {
        ws.close(1011, 'stale')
      } catch {
        // already closed
      }
    }
    if (dirty) await this.changed()
    else await this.schedule()
  }

  /** Forgets a socket's presence; true when it had one. */
  private clear(ws: WebSocket): boolean {
    const me = ws.deserializeAttachment() as Attachment
    if (me.data === undefined) return false
    me.data = undefined
    try {
      ws.serializeAttachment(me)
    } catch {
      // closed: it's excluded from members() anyway
    }
    return true
  }

  private async gone(ws: WebSocket, linger: boolean): Promise<void> {
    const me = ws.deserializeAttachment() as Attachment | null
    if (me?.data === undefined) return
    if (linger && me.connKey)
      await this.ctx.storage.put(`linger:${me.connKey}`, {
        clientId: me.clientId,
        data: me.data,
        until: Date.now() + LINGER_MS
      } satisfies Lingering)
    this.clear(ws)
    await this.changed(ws)
  }

  /** Everyone present: one entry per socket (the app merges a user's sockets), plus lingering ones. */
  private async members(exclude?: WebSocket): Promise<Member[]> {
    const live = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== exclude)
      .map((ws) => ws.deserializeAttachment() as Attachment)
    const connected = new Set(live.map((a) => a.connKey))
    const members = live.filter((a) => a.data !== undefined).map((a) => ({ clientId: a.clientId, data: a.data }))
    const now = Date.now()
    for (const [key, entry] of await this.ctx.storage.list<Lingering>({ prefix: 'linger:' }))
      if (entry.until > now && !connected.has(key.slice('linger:'.length)))
        members.push({ clientId: entry.clientId, data: entry.data })
    return members
  }

  private async changed(exclude?: WebSocket): Promise<void> {
    const frame = JSON.stringify({ t: 'presence', members: await this.members(exclude) })
    for (const ws of this.ctx.getWebSockets()) if (ws !== exclude) send(ws, frame)
    await this.schedule()
  }

  private async schedule(): Promise<void> {
    const busy =
      this.ctx.getWebSockets().some((ws) => isHosting((ws.deserializeAttachment() as Attachment).data)) ||
      (await this.ctx.storage.list({ prefix: 'linger:', limit: 1 })).size > 0
    if (busy && (await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS)
  }
}
