import { describe, expect, it } from 'vitest'
import { RateLimiter, attachmentKind, toRelayPayload } from '../../api/src/discordFormat'

const names = { roles: new Map([['9', 'Mods']]), channels: new Map([['7', 'general']]) }
const author = { id: '1', username: 'ever', global_name: 'Ever' }

describe('discordFormat', () => {
  it('classifies attachments', () => {
    expect(attachmentKind('image/gif')).toBe('gif')
    expect(attachmentKind('image/png')).toBe('image')
    expect(attachmentKind('video/mp4')).toBe('video')
    expect(attachmentKind(undefined)).toBe('file')
  })

  it('resolves mentions and prefers the member nick', () => {
    const payload = toRelayPayload(
      {
        content: 'hi <@2> <@!2> <@&9> <#7> <@3> <:pepe:5>',
        author,
        member: { nick: 'Evie' },
        mentions: [{ id: '2', username: 'sam', global_name: 'Sam' }]
      },
      names
    )
    expect(payload?.author).toBe('Evie')
    expect(payload?.content).toBe('hi @Sam @Sam @Mods #general <@3> <:pepe:5>')
  })

  it('skips bots, webhooks and empty messages', () => {
    expect(toRelayPayload({ content: 'x', author: { ...author, bot: true } }, names)).toBeNull()
    expect(toRelayPayload({ content: 'x', author, webhook_id: '1' }, names)).toBeNull()
    expect(toRelayPayload({ content: ' ', author }, names)).toBeNull()
    expect(toRelayPayload({ content: '', author, sticker_items: [{ name: 'wave' }] }, names)?.stickers).toEqual(['wave'])
  })

  it('limits to 5 per window', () => {
    const limiter = new RateLimiter(5, 5000)
    expect([0, 1, 2, 3, 4, 5].map(() => limiter.allow('a', 100))).toEqual([true, true, true, true, true, false])
    expect(limiter.allow('a', 6000)).toBe(true)
  })
})
