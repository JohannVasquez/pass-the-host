import { Hono } from 'hono'
import { z } from 'zod'
import { getPrisma } from './db'
import type { AppEnv } from './env'

const nameBody = z.object({ name: z.string().trim().min(1).max(32) })

export const profile = new Hono<AppEnv>()

// The app reports the username it already asks for, so other members see who is in a network
profile.put('/', async (c) => {
  const body = nameBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_body' }, 400)
  await getPrisma(c.env.DB).user.update({
    where: { id: c.get('jwtPayload').sub },
    data: { name: body.data.name }
  })
  return c.body(null, 204)
})
