import { DiscordSettings, toRendererSettings, withoutLink } from "@main/contexts/discord-notifications/domain/entities";
import { IServerDiscordSettingsRepository } from "@main/contexts/discord-notifications/domain/repositories";
import { isValidWebhookUrl } from "@main/contexts/discord-notifications/domain/serverLog";

export type DiscordLinkState = {
  status: "none" | "pending" | "linked";
  guildName?: string;
  channelId?: string;
  channelName?: string;
};
export type DiscordChannel = { id: string; name: string; category?: string };

export type LinkApi = <T>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<T>;

const AUTHORIZE_PREFIX = "https://discord.com/oauth2/authorize?";
const SNOWFLAKE_RE = /^\d{1,25}$/;
const status = (e: unknown): number | undefined => (e as { status?: number }).status;

/** Talks to the Worker's /discord/links routes; the link lives in the server's discord settings. */
export class DiscordLinkService {
  constructor(
    private settings: IServerDiscordSettingsRepository,
    private api: LinkApi,
    private openExternal: (url: string) => Promise<void>,
  ) {}

  /** Link routes need the device JWT (added by api) plus the link secret */
  private remote<T>(s: DiscordSettings, suffix = "", method = "GET", body?: unknown): Promise<T> {
    return this.api<T>(`/discord/links/${encodeURIComponent(s.link_id ?? "")}${suffix}`, {
      method,
      body,
      headers: { "X-Link-Secret": s.link_secret ?? "" },
    });
  }

  private linked(serverId: string): DiscordSettings {
    const s = this.settings.get(serverId);
    if (!s.link_id || !s.link_secret) throw new Error("link_not_found");
    return s;
  }

  async startLink(serverId: string): Promise<DiscordLinkState> {
    const prev = this.settings.get(serverId);
    // A new link replaces the old one; failing to delete it remotely must not block the user
    if (prev.link_id && prev.link_secret) await this.remote(prev, "", "DELETE").catch(() => undefined);
    const created = await this.api<{ id: string; secret: string; authorizeUrl: string }>(
      "/discord/links",
      { method: "POST" },
    );
    this.settings.save(serverId, {
      ...withoutLink(prev),
      link_id: created.id,
      link_secret: created.secret,
    });
    // Only Discord's own authorization page is ever opened
    if (typeof created.authorizeUrl !== "string" || !created.authorizeUrl.startsWith(AUTHORIZE_PREFIX)) {
      throw new Error("discord_unavailable");
    }
    await this.openExternal(created.authorizeUrl);
    return { status: "pending" };
  }

  async getLinkState(serverId: string): Promise<DiscordLinkState> {
    const s = this.settings.get(serverId);
    if (!s.link_id || !s.link_secret) return { status: "none" };
    try {
      const r = await this.remote<DiscordLinkState>(s);
      if (r.status !== "linked") return { status: "pending" };
      const channelId = SNOWFLAKE_RE.test(r.channelId ?? "") ? r.channelId : undefined;
      this.settings.save(serverId, {
        ...s,
        guild_name: r.guildName,
        ...(channelId && { channel_id: channelId, channel_name: r.channelName }),
      });
      return { status: "linked", guildName: r.guildName, channelId, channelName: r.channelName };
    } catch (e) {
      if (status(e) === 404 && (e as Error).message === "link_not_found") {
        this.settings.save(serverId, withoutLink(s));
        return { status: "none" };
      }
      throw e;
    }
  }

  listChannels(serverId: string): Promise<DiscordChannel[]> {
    return this.remote<DiscordChannel[]>(this.linked(serverId), "/channels");
  }

  async selectChannel(serverId: string, channelId: string): Promise<DiscordSettings> {
    if (typeof channelId !== "string" || !SNOWFLAKE_RE.test(channelId)) throw new Error("invalid_body");
    const s = this.linked(serverId);
    const r = await this.remote<{ channelId: string; channelName: string; webhookUrl: string }>(
      s,
      "",
      "PUT",
      { channelId },
    );
    if (!isValidWebhookUrl(r.webhookUrl)) throw new Error("discord_unavailable");
    const next: DiscordSettings = {
      ...s,
      channel_id: r.channelId,
      channel_name: r.channelName,
      webhook_url: r.webhookUrl,
      // Remembered so unlink only removes a webhook this link created
      link_webhook_id: new URL(r.webhookUrl).pathname.split("/")[3],
      relay_to_game: true,
    };
    this.settings.save(serverId, next);
    return toRendererSettings(this.settings.get(serverId));
  }

  async unlink(serverId: string): Promise<DiscordSettings> {
    const s = this.settings.get(serverId);
    if (s.link_id && s.link_secret) {
      try {
        await this.remote(s, "", "DELETE");
      } catch (e) {
        if (status(e) !== 404) throw e;
      }
    }
    this.settings.save(serverId, withoutLink(s));
    return toRendererSettings(this.settings.get(serverId));
  }
}
