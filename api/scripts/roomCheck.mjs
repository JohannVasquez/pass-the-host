// End-to-end check of the RoomHub Durable Object against `wrangler dev --port 8799`:
//   node scripts/roomCheck.mjs [baseUrl]
import assert from 'node:assert/strict'

const BASE = process.argv[2] ?? 'http://localhost:8799'

const call = async (path, token, init = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }
  })
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}
const device = async () => (await call('/auth/device', null, { method: 'POST' })).body.token

/** Opens a room socket and records every frame it gets. */
const open = async (groupId, token) => {
  const { body } = await call(`/rooms/${groupId}/ticket`, token, { method: 'POST' })
  const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/rooms/${groupId}/ws?ticket=${body.ticket}`)
  const frames = []
  let closed = null
  ws.onmessage = (e) => frames.push(e.data === 'pong' ? 'pong' : JSON.parse(e.data))
  ws.onclose = (e) => (closed = e.code)
  await new Promise((resolve, reject) => ((ws.onopen = resolve), (ws.onerror = reject)))
  const until = async (pred, what) => {
    for (let i = 0; i < 50; i++) {
      const hit = frames.find(pred)
      if (hit) return hit
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`timed out waiting for ${what}`)
  }
  return { ws, frames, until, closed: () => closed, send: (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)) }
}
const lastPresence = (c) => c.frames.filter((f) => f.t === 'presence').at(-1)?.members ?? []

assert.deepEqual((await call('/config')).body, { realtime: 'ably' })

const [hostToken, friendToken, outsiderToken] = await Promise.all([device(), device(), device()])
const group = (await call('/groups', hostToken, { method: 'POST', body: JSON.stringify({ name: 'room check' }) })).body
await call('/groups/join', friendToken, { method: 'POST', body: JSON.stringify({ code: group.inviteCode }) })

// Only members get a ticket, and only a room ticket opens the socket
assert.equal((await call(`/rooms/${group.id}/ticket`, outsiderToken, { method: 'POST' })).status, 404)
const forged = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/rooms/${group.id}/ws?ticket=${hostToken}`)
assert.equal(await new Promise((resolve) => ((forged.onopen = () => resolve('open')), (forged.onerror = () => resolve('rejected')))), 'rejected')

const host = await open(group.id, hostToken)
const friend = await open(group.id, friendToken)
const hostId = (await host.until((f) => f.t === 'hello', 'host hello')).clientId
const friendId = (await friend.until((f) => f.t === 'hello', 'friend hello')).clientId

// Presence reaches everyone
host.send({ t: 'presence', connKey: 'host-1', data: { name: 'Host', hosting: true } })
await friend.until((f) => f.t === 'presence' && f.members.some((m) => m.clientId === hostId && m.data.hosting), 'host presence')

// Addressed messages only reach their target, stamped with the sender's id
host.send({ t: 'pub', name: 'webrtc_answer', data: { peerId: 'p', sdp: 'x', to: friendId } })
friend.send({ t: 'pub', name: 'webrtc_offer', data: { peerId: 'p', sdp: 'y', to: hostId } })
const offer = await host.until((f) => f.t === 'msg' && f.name === 'webrtc_offer', 'offer')
assert.equal(offer.clientId, friendId)
const answer = await friend.until((f) => f.t === 'msg' && f.name === 'webrtc_answer', 'answer')
assert.equal(answer.clientId, hostId)
assert.equal(host.frames.filter((f) => f.t === 'msg' && f.name === 'webrtc_answer').length, 0, 'no echo to sender')

// Pings are answered by the runtime
host.send('ping')
await host.until((f) => f === 'pong', 'pong')

// An abrupt drop lingers ~15 s; reconnecting with the same connKey takes over without a gap
host.ws.close(4000, 'blip')
await new Promise((r) => setTimeout(r, 500))
assert.ok(lastPresence(friend).some((m) => m.clientId === hostId), 'host lingers after a blip')
const host2 = await open(group.id, hostToken)
host2.send({ t: 'presence', connKey: 'host-1', data: { name: 'Host', hosting: true } })
await new Promise((r) => setTimeout(r, 500))
assert.equal(lastPresence(friend).filter((m) => m.clientId === hostId).length, 1, 'no duplicate after reconnect')

// A normal close leaves right away
host2.ws.close(1000)
await friend.until(() => !lastPresence(friend).some((m) => m.clientId === hostId), 'host gone after close')

// Removing a member closes their socket with 4403
await call(`/groups/${group.id}/members/${friendId}`, hostToken, { method: 'DELETE' })
for (let i = 0; i < 50 && friend.closed() === null; i++) await new Promise((r) => setTimeout(r, 100))
assert.equal(friend.closed(), 4403)

await call(`/groups/${group.id}`, hostToken, { method: 'DELETE' })
console.log('room check passed')
process.exit(0)
