import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { getPrisma } from './db'
import type { AppEnv } from './env'

// A ticket opens one room's socket for a minute. The device token never goes in a URL (URLs get logged).
const TICKET_TTL_S = 60

export const roomStub = (env: AppEnv['Bindings'], groupId: string) => env.ROOM_HUB.get(env.ROOM_HUB.idFromName(groupId))

export const rooms = new Hono<AppEnv>()

rooms.post('/rooms/:id/ticket', async (c) => {
  const userId = c.get('jwtPayload').sub
  const groupId = c.req.param('id')
  const member = await getPrisma(c.env.DB).groupMember.findFirst({ where: { userId, groupId }, select: { userId: true } })
  if (!member) return c.json({ error: 'group_not_found' }, 404)
  const exp = Math.floor(Date.now() / 1000) + TICKET_TTL_S
  return c.json({ ticket: await sign({ sub: userId, gid: groupId, typ: 'room', exp }, c.env.JWT_SECRET, 'HS256') })
})

export const roomsPublic = new Hono<AppEnv>()

// Which realtime backend apps use: flip REALTIME in wrangler.jsonc and deploy, no app release needed
roomsPublic.get('/config', (c) => c.json({ realtime: c.env.REALTIME === 'do' ? 'do' : 'ably' }))

roomsPublic.get('/rooms/:id/ws', async (c) => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.text('Expected WebSocket', 426)
  const groupId = c.req.param('id')
  const payload = await verify(c.req.query('ticket') ?? '', c.env.JWT_SECRET, 'HS256').catch(() => null)
  if (payload?.typ !== 'room' || payload.gid !== groupId || typeof payload.sub !== 'string')
    return c.json({ error: 'unauthorized' }, 401)
  const headers = new Headers(c.req.raw.headers)
  headers.set('X-User-Id', payload.sub)
  return roomStub(c.env, groupId).fetch(new Request(c.req.raw.url, { headers }))
})
