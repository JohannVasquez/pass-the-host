/** Per-server Discord webhook relay; nothing is sent while webhook_url is empty */
export interface DiscordSettings {
  webhook_url?: string;
  relay_chat?: boolean;
  notify_status?: boolean;
  notify_joins?: boolean;
}

export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhook_url: "",
  relay_chat: true,
  notify_status: true,
  notify_joins: false,
};
