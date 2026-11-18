// Pure helpers for the Discord relay, kept apart from the Durable Object so they are easy to test.

export type DiscordMessage = {
  content?: string
  author?: { id: string; username: string; global_name?: string | null; bot?: boolean }
  member?: { nick?: string | null }
  mentions?: { id: string; username: string; global_name?: string | null; member?: { nick?: string | null } }[]
  attachments?: { url: string; filename: string; content_type?: string }[]
  sticker_items?: { name: string }[]
  webhook_id?: string
  message_reference?: { message_id?: string }
  referenced_message?: {
    author?: { username: string; global_name?: string | null }
    member?: { nick?: string | null }
  } | null
}

export type GuildNames = { roles: Map<string, string>; channels: Map<string, string> }
export type AttachmentKind = 'image' | 'gif' | 'video' | 'file'

export const attachmentKind = (contentType?: string): AttachmentKind => {
  if (!contentType) return 'file'
  if (contentType.startsWith('image/gif')) return 'gif'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  return 'file'
}

export const displayName = (u: {
  username: string
  global_name?: string | null
  nick?: string | null
}): string => u.nick || u.global_name || u.username

// Mentions arrive as ids; Minecraft needs readable names
export const resolveMentions = (content: string, mentions: DiscordMessage['mentions'], names: GuildNames): string => {
  const users = new Map((mentions ?? []).map((u) => [u.id, displayName({ ...u, nick: u.member?.nick })]))
  return content
    .replace(/<@!?(\d+)>/g, (m, id) => (users.has(id) ? `@${users.get(id)}` : m))
    .replace(/<@&(\d+)>/g, (m, id) => (names.roles.has(id) ? `@${names.roles.get(id)}` : m))
    .replace(/<#(\d+)>/g, (m, id) => (names.channels.has(id) ? `#${names.channels.get(id)}` : m))
}

export type RelayPayload = {
  type: 'message'
  author: string
  content: string
  replyTo?: string
  attachments: { kind: AttachmentKind; url: string; name: string }[]
  stickers: string[]
}

// Returns null for messages that must not reach the game (bots, webhooks, empty)
export const toRelayPayload = (msg: DiscordMessage, names: GuildNames): RelayPayload | null => {
  if (!msg.author || msg.author.bot || msg.webhook_id) return null
  const attachments = (msg.attachments ?? []).map((a) => ({
    kind: attachmentKind(a.content_type),
    url: a.url,
    name: a.filename
  }))
  const stickers = (msg.sticker_items ?? []).map((s) => s.name)
  const content = resolveMentions(msg.content ?? '', msg.mentions, names)
  if (!content.trim() && !attachments.length && !stickers.length) return null
  const ref = msg.referenced_message
  const payload: RelayPayload = {
    type: 'message',
    author: displayName({ ...msg.author, nick: msg.member?.nick }),
    content,
    attachments,
    stickers
  }
  if (ref?.author) payload.replyTo = displayName({ ...ref.author, nick: ref.member?.nick })
  return payload
}

// Sliding window: at most `limit` events per `windowMs` per key
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(
    private limit: number,
    private windowMs: number
  ) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }
}
