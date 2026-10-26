import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { getPrisma } from './db'
import type { AppEnv } from './env'

export const device = new Hono<AppEnv>()

// Each install registers itself once and keeps the token; there is no login.
// The token never expires: it only lives encrypted on that device.
device.post('/device', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  const { success } = await c.env.SIGNUP_LIMITER.limit({ key: ip })
  if (!success) return c.json({ error: 'too_many_requests' }, 429)
  const user = await getPrisma(c.env.DB).user.create({ data: {} })
  return c.json({ token: await sign({ sub: user.id }, c.env.JWT_SECRET, 'HS256') }, 201)
})
