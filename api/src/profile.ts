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
  const { count } = await getPrisma(c.env.DB).user.updateMany({
    where: { id: c.get('jwtPayload').sub },
    data: { name: body.data.name }
  })
  // A token whose user was deleted gets 401, so the app registers the device again
  return count ? c.body(null, 204) : c.json({ error: 'user_not_found' }, 401)
})

// Erases everything stored about this device: its memberships, the rooms it created
// (with their members) and the user itself
profile.delete('/', async (c) => {
  const userId = c.get('jwtPayload').sub
  const prisma = getPrisma(c.env.DB)
  const owned = { ownerId: userId }
  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { OR: [{ userId }, { group: owned }] } }),
    prisma.serverGroup.deleteMany({ where: owned }),
    prisma.user.deleteMany({ where: { id: userId } })
  ])
  return c.body(null, 204)
})
