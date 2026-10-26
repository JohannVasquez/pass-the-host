import * as Ably from 'ably'
import { Hono } from 'hono'
import { getPrisma } from './db'
import type { AppEnv } from './env'

export const realtime = new Hono<AppEnv>()

// Signs a TokenRequest scoped to the caller's groups; the root key never leaves the Worker.
realtime.get('/ably-auth', async (c) => {
  const userId = c.get('jwtPayload').sub
  const memberships = await getPrisma(c.env.DB).groupMember.findMany({
    where: { userId },
    select: { groupId: true }
  })
  if (memberships.length === 0) return c.json({ error: 'no_groups' }, 403)
  const capability = Object.fromEntries(
    memberships.map(({ groupId }) => [`server:${groupId}`, ['presence', 'publish', 'subscribe'] as Ably.capabilityOp[]])
  )
  const tokenRequest = await new Ably.Rest({ key: c.env.ABLY_API_KEY }).auth.createTokenRequest({
    clientId: userId,
    capability,
    // Short-lived so leaving or being removed from a room cuts channel access soon after
    ttl: 10 * 60 * 1000
  })
  return c.json(tokenRequest)
})
