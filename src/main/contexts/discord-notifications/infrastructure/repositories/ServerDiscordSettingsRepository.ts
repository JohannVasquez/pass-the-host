import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { FileSystemError, ValidationError } from "@shared/domain/errors";
import {
  DEFAULT_DISCORD_SETTINGS,
  DiscordSettings,
} from "@main/contexts/discord-notifications/domain/entities";
import { DISCORD_LANGUAGES } from "@main/contexts/discord-notifications/domain/messages";
import { IServerDiscordSettingsRepository } from "@main/contexts/discord-notifications/domain/repositories";

const text = (v: unknown, max: number, re?: RegExp): string | undefined =>
  typeof v === "string" && v.length > 0 && v.length <= max && (!re || re.test(v)) ? v : undefined;
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;
const SNOWFLAKE_RE = /^\d{1,25}$/;

/** Link fields are only kept when well-formed; the link_secret is a secret, never log it */
export function linkFields(s: DiscordSettings | undefined): DiscordSettings {
  const clean: DiscordSettings = {
    link_id: text(s?.link_id, 64, TOKEN_RE),
    link_secret: text(s?.link_secret, 128, TOKEN_RE),
    guild_name: text(s?.guild_name, 100),
    channel_id: text(s?.channel_id, 25, SNOWFLAKE_RE),
    channel_name: text(s?.channel_name, 100),
    link_webhook_id: text(s?.link_webhook_id, 25, SNOWFLAKE_RE),
  };
  return Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined));
}

/** Stores the settings under the `discord` key of the server's server_info.json (synced with the server). */
export class ServerDiscordSettingsRepository implements IServerDiscordSettingsRepository {
  private infoPath(serverId: string): string {
    // Trust boundary: serverId comes from the renderer and becomes a path segment.
    if (
      typeof serverId !== "string" ||
      serverId === "" ||
      serverId === "." ||
      serverId === ".." ||
      path.basename(serverId) !== serverId ||
      serverId.includes("\\")
    ) {
      throw new ValidationError("Invalid server id");
    }
    return path.join(app.getPath("userData"), "servers", serverId, "server_info.json");
  }

  private read(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }

  get(serverId: string): DiscordSettings {
    const file = this.infoPath(serverId);
    try {
      return { ...DEFAULT_DISCORD_SETTINGS, ...(this.read(file)?.discord as DiscordSettings) };
    } catch {
      return { ...DEFAULT_DISCORD_SETTINGS };
    }
  }

  save(serverId: string, settings: DiscordSettings): void {
    const file = this.infoPath(serverId);
    if (!fs.existsSync(file)) throw new FileSystemError("Server not found");
    try {
      const info = this.read(file);
      // Keep only known keys. The webhook URL is a secret, never log it.
      const url = typeof settings?.webhook_url === "string" ? settings.webhook_url.trim() : "";
      info.discord = {
        webhook_url: url.slice(0, 500),
        relay_chat: settings?.relay_chat === true,
        notify_status: settings?.notify_status === true,
        notify_joins: settings?.notify_joins === true,
        ...(settings?.relay_to_game === true && { relay_to_game: true }),
        ...linkFields(settings),
        ...(DISCORD_LANGUAGES.some((l) => l === settings?.language) && {
          language: settings.language,
        }),
      };
      fs.writeFileSync(file, JSON.stringify(info, null, 2), "utf-8");
    } catch {
      throw new FileSystemError("Failed to save Discord settings");
    }
  }

  serverVersion(serverId: string): string | undefined {
    try {
      const v = this.read(this.infoPath(serverId))?.version;
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    } catch {
      return undefined;
    }
  }

  serverName(serverId: string): string {
    try {
      const name = this.read(this.infoPath(serverId))?.name;
      return typeof name === "string" && name.trim() ? name.trim() : serverId;
    } catch {
      return serverId;
    }
  }
}
