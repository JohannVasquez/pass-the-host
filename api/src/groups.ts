import { Hono } from 'hono'
import { z } from 'zod'
import { getPrisma } from './db'
import type { AppEnv } from './env'

const createBody = z.object({ name: z.string().trim().min(1).max(50) })
const joinBody = z.object({ code: z.string().max(32) })
const groupSelect = {
  id: true,
  name: true,
  inviteCode: true,
  ownerId: true,
  createdAt: true,
  _count: { select: { members: true } }
} as const

// 32 symbols without look-alikes (0/O, 1/I); 12 of them give ~10^18 codes
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newInviteCode = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => CODE_ALPHABET[byte % 32]).join('')
const normalizeCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
const isUniqueViolation = (error: unknown): boolean => (error as { code?: string }).code === 'P2002'
// Runs a write that stores a new invite code, retrying the rare collision
const withNewCode = async <T>(write: (inviteCode: string) => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write(newInviteCode())
    } catch (error) {
      if (attempt >= 3 || !isUniqueViolation(error)) throw error
    }
  }
}
// isOwner lets the app show owner-only actions without knowing its own user id
const toGroup = <T extends { ownerId: string; _count: { members: number } }>(
  { _count, ...group }: T,
  userId: string
) => ({ ...group, isOwner: group.ownerId === userId, memberCount: _count.members })

export const groups = new Hono<AppEnv>()

groups.get('/', async (c) => {
  const userId = c.get('jwtPayload').sub
  const list = await getPrisma(c.env.DB).serverGroup.findMany({
    where: { members: { some: { userId } } },
    select: groupSelect,
    orderBy: { createdAt: 'asc' }
  })
  return c.json(list.map((group) => toGroup(group, userId)))
})

groups.post('/', async (c) => {
  const body = createBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_body' }, 400)
  const userId = c.get('jwtPayload').sub
  const group = await withNewCode((inviteCode) =>
    getPrisma(c.env.DB).serverGroup.create({
      data: { name: body.data.name, inviteCode, ownerId: userId, members: { create: { userId } } },
      select: groupSelect
    })
  )
  return c.json(toGroup(group, userId), 201)
})

groups.post('/join', async (c) => {
  const userId = c.get('jwtPayload').sub
  // Invite codes are short, so guessing them has to be slow
  const { success } = await c.env.JOIN_LIMITER.limit({ key: userId })
  if (!success) return c.json({ error: 'too_many_requests' }, 429)
  const body = joinBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_body' }, 400)
  const prisma = getPrisma(c.env.DB)
  const found = await prisma.serverGroup.findUnique({
    where: { inviteCode: normalizeCode(body.data.code) },
    select: { id: true }
  })
  if (!found) return c.json({ error: 'group_not_found' }, 404)
  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId, groupId: found.id } },
    create: { userId, groupId: found.id },
    update: {}
  })
  // Read after joining so memberCount includes the new member
  const group = await prisma.serverGroup.findUniqueOrThrow({ where: { id: found.id }, select: groupSelect })
  return c.json(toGroup(group, userId))
})

groups.get('/:id/members', async (c) => {
  const userId = c.get('jwtPayload').sub
  const members = await getPrisma(c.env.DB).groupMember.findMany({
    where: { groupId: c.req.param('id') },
    select: { user: { select: { id: true, name: true } }, group: { select: { ownerId: true } } },
    orderBy: { joinedAt: 'asc' }
  })
  // Non-members get the same answer as a missing group
  if (!members.some((m) => m.user.id === userId)) return c.json({ error: 'group_not_found' }, 404)
  return c.json(
    members.map(({ user, group }) => ({
      // Matches the Ably clientId, so the app can tell who is online
      id: user.id,
      name: user.name,
      isOwner: user.id === group.ownerId,
      isYou: user.id === userId
    }))
  )
})

groups.delete('/:id/membership', async (c) => {
  const userId = c.get('jwtPayload').sub
  const groupId = c.req.param('id')
  const prisma = getPrisma(c.env.DB)
  const group = await prisma.serverGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } })
  if (!group) return c.json({ error: 'group_not_found' }, 404)
  // The creator deletes the room instead; leaving would orphan it
  if (group.ownerId === userId) return c.json({ error: 'owner_cannot_leave' }, 409)
  await prisma.groupMember.deleteMany({ where: { userId, groupId } })
  return c.body(null, 204)
})

// The creator replaces a leaked code; members already in the room stay
groups.post('/:id/invite-code', async (c) => {
  const userId = c.get('jwtPayload').sub
  const groupId = c.req.param('id')
  const prisma = getPrisma(c.env.DB)
  const group = await prisma.serverGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } })
  if (!group) return c.json({ error: 'group_not_found' }, 404)
  if (group.ownerId !== userId) return c.json({ error: 'not_group_owner' }, 403)
  const updated = await withNewCode((inviteCode) =>
    prisma.serverGroup.update({ where: { id: groupId }, data: { inviteCode }, select: groupSelect })
  )
  return c.json(toGroup(updated, userId))
})

// The creator removes a member; the code changes too, since the removed member knows it
groups.delete('/:id/members/:userId', async (c) => {
  const userId = c.get('jwtPayload').sub
  const groupId = c.req.param('id')
  const memberId = c.req.param('userId')
  const prisma = getPrisma(c.env.DB)
  const group = await prisma.serverGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } })
  if (!group) return c.json({ error: 'group_not_found' }, 404)
  if (group.ownerId !== userId) return c.json({ error: 'not_group_owner' }, 403)
  if (memberId === userId) return c.json({ error: 'owner_cannot_leave' }, 409)
  await withNewCode((inviteCode) =>
    prisma.$transaction([
      prisma.groupMember.deleteMany({ where: { userId: memberId, groupId } }),
      prisma.serverGroup.update({ where: { id: groupId }, data: { inviteCode } })
    ])
  )
  return c.body(null, 204)
})

groups.delete('/:id', async (c) => {
  const userId = c.get('jwtPayload').sub
  const groupId = c.req.param('id')
  const prisma = getPrisma(c.env.DB)
  const group = await prisma.serverGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } })
  if (!group) return c.json({ error: 'group_not_found' }, 404)
  if (group.ownerId !== userId) return c.json({ error: 'not_group_owner' }, 403)
  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId } }),
    prisma.serverGroup.delete({ where: { id: groupId } })
  ])
  return c.body(null, 204)
})
