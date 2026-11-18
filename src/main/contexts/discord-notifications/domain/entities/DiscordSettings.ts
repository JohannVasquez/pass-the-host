/** Per-server Discord webhook relay; nothing is sent while webhook_url is empty */
export interface DiscordSettings {
  webhook_url?: string;
  relay_chat?: boolean;
  notify_status?: boolean;
  notify_joins?: boolean;
  /** Language of the status/join notices (see domain/messages.ts) */
  language?: string;
  /** Discord → Minecraft link made through the Pass the host bot (managed only by the link handlers) */
  link_id?: string;
  /** Never leaves the main process (see toRendererSettings) */
  link_secret?: string;
  guild_name?: string;
  channel_id?: string;
  channel_name?: string;
  /** Id of the webhook the link created, so unlinking never removes a manually entered one */
  link_webhook_id?: string;
  /** Relay messages of the linked channel into the game chat */
  relay_to_game?: boolean;
}

const LINK_KEYS = [
  "link_id",
  "link_secret",
  "guild_name",
  "channel_id",
  "channel_name",
  "link_webhook_id",
] as const;

/** What the renderer may see: everything but the link secret */
export const toRendererSettings = (s: DiscordSettings): DiscordSettings => {
  const { link_secret: _secret, ...rest } = s;
  return rest;
};

/** A renderer save can't touch the link: those fields always come from what is stored */
export const withStoredLink = (incoming: DiscordSettings, stored: DiscordSettings): DiscordSettings => {
  const out: DiscordSettings = { ...incoming };
  for (const k of LINK_KEYS) {
    delete out[k];
    if (stored[k] !== undefined) out[k] = stored[k];
  }
  return out;
};

/** Link fields cleared; the webhook_url goes too only when it is the one the link created */
export const withoutLink = (s: DiscordSettings): DiscordSettings => {
  const out: DiscordSettings = { ...s, relay_to_game: false };
  for (const k of LINK_KEYS) delete out[k];
  if (s.link_webhook_id && s.webhook_url?.includes(`/api/webhooks/${s.link_webhook_id}/`)) {
    out.webhook_url = "";
  }
  return out;
};

export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhook_url: "",
  relay_chat: true,
  notify_status: true,
  notify_joins: false,
  relay_to_game: false,
};
