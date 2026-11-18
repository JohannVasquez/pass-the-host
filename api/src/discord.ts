import { Hono } from 'hono'
import { z } from 'zod'
import { getPrisma } from './db'
import type { AppEnv } from './env'

const DISCORD_API = 'https://discord.com/api/v10'
// View Channels (1024) + Manage Webhooks (536870912)
const BOT_PERMISSIONS = '536871936'
const STATE_TTL_MS = 15 * 60 * 1000

const putBody = z.object({ channelId: z.string().regex(/^\d{1,25}$/) })

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const randomToken = (): string => toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
const sha256Hex = async (text: string): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
const safeEqual = (a: string, b: string): boolean => {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  // Hashes have equal length, so the early exit leaks nothing useful
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

// Wrong secret looks exactly like a missing link
export const findLink = async (db: D1Database, id: string, secret: string | undefined) => {
  if (!secret) return null
  const link = await getPrisma(db).discordLink.findUnique({ where: { id } })
  if (!link || !safeEqual(await sha256Hex(secret), link.secretHash)) return null
  return link
}

const bot = (env: AppEnv['Bindings'], path: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }
  })

// Pages are tiny and self-contained: no external resources, text picked from Accept-Language
const PAGES = {
  en: { ok: 'Discord connected. You can go back to Pass the host.', cancelled: 'Authorization cancelled. You can close this tab.', error: 'Something went wrong. Go back to Pass the host and try again.' },
  es: { ok: 'Discord conectado. Ya puedes volver a Pass the host.', cancelled: 'Autorización cancelada. Puedes cerrar esta pestaña.', error: 'Algo salió mal. Vuelve a Pass the host e inténtalo de nuevo.' },
  'pt-BR': { ok: 'Discord conectado. Você já pode voltar ao Pass the host.', cancelled: 'Autorização cancelada. Você pode fechar esta aba.', error: 'Algo deu errado. Volte ao Pass the host e tente novamente.' },
  de: { ok: 'Discord verbunden. Du kannst zu Pass the host zurückkehren.', cancelled: 'Autorisierung abgebrochen. Du kannst diesen Tab schließen.', error: 'Etwas ist schiefgelaufen. Kehre zu Pass the host zurück und versuche es erneut.' },
  fr: { ok: 'Discord connecté. Vous pouvez retourner dans Pass the host.', cancelled: 'Autorisation annulée. Vous pouvez fermer cet onglet.', error: "Une erreur s'est produite. Retournez dans Pass the host et réessayez." },
  ru: { ok: 'Discord подключён. Можно вернуться в Pass the host.', cancelled: 'Авторизация отменена. Можно закрыть эту вкладку.', error: 'Что-то пошло не так. Вернитесь в Pass the host и попробуйте снова.' }
} as const
type Lang = keyof typeof PAGES

const pickLang = (header: string | undefined): Lang => {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase()
    if (tag.startsWith('pt')) return 'pt-BR'
    const base = tag.split('-')[0]
    if (base === 'en' || base === 'es' || base === 'de' || base === 'fr' || base === 'ru') return base
  }
  return 'en'
}
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

const page = (lang: Lang, kind: keyof (typeof PAGES)['en'], status = 200): Response => {
  const text = escapeHtml(PAGES[lang][kind])
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pass the host</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#16181d;color:#e8eaee;text-align:center}main{padding:24px;max-width:420px}h1{font-size:20px;margin:0 0 12px}</style></head><body><main><h1>Pass the host</h1><p>${text}</p></main></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
  })
}

type TokenResponse = { guild?: { id?: string; name?: string } }
type DiscordChannel = {
  id: string
  name: string
  type: number
  position?: number
  parent_id?: string | null
  guild_id?: string
}

const gatewayStub = (env: AppEnv['Bindings']) => env.DISCORD_GATEWAY.get(env.DISCORD_GATEWAY.idFromName('gateway'))
// Tells the Durable Object that open sockets of this link must re-read it (channel changed or link deleted)
const notifyGateway = (env: AppEnv['Bindings'], linkId: string): Promise<unknown> =>
  gatewayStub(env)
    .fetch('https://gateway/refresh', { method: 'POST', body: JSON.stringify({ linkId }) })
    .catch(() => undefined)

// Public routes: Discord redirects the browser to the callback and the app opens the stream before authenticating
export const discordPublic = new Hono<AppEnv>()

discordPublic.get('/discord/callback', async (c) => {
  const lang = pickLang(c.req.header('Accept-Language'))
  if (c.req.query('error')) return page(lang, 'cancelled')
  const state = c.req.query('state')
  const code = c.req.query('code')
  if (!state || !code) return page(lang, 'error', 400)
  const prisma = getPrisma(c.env.DB)
  const link = await prisma.discordLink.findUnique({ where: { state } })
  if (!link || !link.stateExpiresAt || link.stateExpiresAt.getTime() < Date.now()) return page(lang, 'error', 400)
  // Single use: only one request can clear the state, a replay matches no row
  const claimed = await prisma.discordLink.updateMany({
    where: { id: link.id, state },
    data: { state: null, stateExpiresAt: null }
  })
  if (claimed.count === 0) return page(lang, 'error', 400)
  const exchange = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${c.env.DISCORD_CLIENT_ID}:${c.env.DISCORD_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${new URL(c.req.url).origin}/api/discord/callback`
    })
  }).catch(() => null)
  if (!exchange?.ok) return page(lang, 'error', 502)
  // The guild comes from Discord's answer, never from the query string
  const guild = ((await exchange.json().catch(() => ({}))) as TokenResponse).guild
  if (!guild?.id || !guild.name) return page(lang, 'error', 502)
  await prisma.discordLink.update({ where: { id: link.id }, data: { guildId: guild.id, guildName: guild.name } })
  return page(lang, 'ok')
})

discordPublic.get('/discord/stream', async (c) => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.text('Expected WebSocket', 426)
  return gatewayStub(c.env).fetch(c.req.raw)
})

export const discord = new Hono<AppEnv>()

discord.post('/discord/links', async (c) => {
  const userId = c.get('jwtPayload').sub
  const { success } = await c.env.DISCORD_LIMITER.limit({ key: userId })
  if (!success) return c.json({ error: 'too_many_requests' }, 429)
  const secret = randomToken()
  const state = randomToken()
  const link = await getPrisma(c.env.DB).discordLink.create({
    data: {
      secretHash: await sha256Hex(secret),
      createdBy: userId,
      state,
      stateExpiresAt: new Date(Date.now() + STATE_TTL_MS),
      // Filled in by the callback and by PUT; empty means "not yet"
      guildId: '',
      guildName: '',
      channelId: '',
      channelName: ''
    },
    select: { id: true }
  })
  const authorize = new URL('https://discord.com/oauth2/authorize')
  authorize.search = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    scope: 'bot',
    permissions: BOT_PERMISSIONS,
    response_type: 'code',
    redirect_uri: `${new URL(c.req.url).origin}/api/discord/callback`,
    state
  }).toString()
  return c.json({ id: link.id, secret, authorizeUrl: authorize.toString() }, 201)
})

discord.get('/discord/links/:id', async (c) => {
  const link = await findLink(c.env.DB, c.req.param('id'), c.req.header('X-Link-Secret'))
  if (!link) return c.json({ error: 'link_not_found' }, 404)
  if (!link.guildId) return c.json({ status: 'pending' })
  return c.json({
    status: 'linked',
    guildName: link.guildName,
    ...(link.channelId ? { channelId: link.channelId, channelName: link.channelName } : {})
  })
})

discord.get('/discord/links/:id/channels', async (c) => {
  const link = await findLink(c.env.DB, c.req.param('id'), c.req.header('X-Link-Secret'))
  if (!link) return c.json({ error: 'link_not_found' }, 404)
  if (!link.guildId) return c.json({ error: 'link_pending' }, 409)
  const res = await bot(c.env, `/guilds/${link.guildId}/channels`).catch(() => null)
  if (!res?.ok) return c.json({ error: 'discord_unavailable' }, 502)
  const all = (await res.json()) as DiscordChannel[]
  const categories = new Map(all.filter((ch) => ch.type === 4).map((ch) => [ch.id, ch]))
  const order = (ch: DiscordChannel): number => categories.get(ch.parent_id ?? '')?.position ?? -1
  const list = all
    .filter((ch) => ch.type === 0 || ch.type === 5)
    .sort((a, b) => order(a) - order(b) || (a.position ?? 0) - (b.position ?? 0))
    .map((ch) => {
      const category = categories.get(ch.parent_id ?? '')?.name
      return { id: ch.id, name: ch.name, ...(category ? { category } : {}) }
    })
  return c.json(list)
})

discord.put('/discord/links/:id', async (c) => {
  const link = await findLink(c.env.DB, c.req.param('id'), c.req.header('X-Link-Secret'))
  if (!link) return c.json({ error: 'link_not_found' }, 404)
  if (!link.guildId) return c.json({ error: 'link_pending' }, 409)
  const body = putBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_body' }, 400)
  const channelRes = await bot(c.env, `/channels/${body.data.channelId}`).catch(() => null)
  if (!channelRes) return c.json({ error: 'discord_unavailable' }, 502)
  if (channelRes.status === 403) return c.json({ error: 'missing_permissions' }, 403)
  if (channelRes.status === 404) return c.json({ error: 'channel_not_found' }, 404)
  if (!channelRes.ok) return c.json({ error: 'discord_unavailable' }, 502)
  const channel = (await channelRes.json()) as DiscordChannel
  // A link may only touch channels of its own guild
  if (channel.guild_id !== link.guildId || (channel.type !== 0 && channel.type !== 5)) {
    return c.json({ error: 'channel_not_found' }, 404)
  }
  if (link.webhookId) await bot(c.env, `/webhooks/${link.webhookId}`, { method: 'DELETE' }).catch(() => undefined)
  const hookRes = await bot(c.env, `/channels/${channel.id}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Pass the host' })
  }).catch(() => null)
  if (!hookRes) return c.json({ error: 'discord_unavailable' }, 502)
  if (hookRes.status === 403) return c.json({ error: 'missing_permissions' }, 403)
  if (!hookRes.ok) return c.json({ error: 'discord_unavailable' }, 502)
  const hook = (await hookRes.json()) as { id: string; token: string }
  await getPrisma(c.env.DB).discordLink.update({
    where: { id: link.id },
    // The webhook token is not stored: the app keeps it
    data: { channelId: channel.id, channelName: channel.name, webhookId: hook.id }
  })
  await notifyGateway(c.env, link.id)
  return c.json({
    channelId: channel.id,
    channelName: channel.name,
    webhookUrl: `https://discord.com/api/webhooks/${hook.id}/${hook.token}`
  })
})

discord.delete('/discord/links/:id', async (c) => {
  const link = await findLink(c.env.DB, c.req.param('id'), c.req.header('X-Link-Secret'))
  if (!link) return c.json({ error: 'link_not_found' }, 404)
  if (link.webhookId) await bot(c.env, `/webhooks/${link.webhookId}`, { method: 'DELETE' }).catch(() => undefined)
  await getPrisma(c.env.DB).discordLink.delete({ where: { id: link.id } })
  await notifyGateway(c.env, link.id)
  return c.body(null, 204)
})
