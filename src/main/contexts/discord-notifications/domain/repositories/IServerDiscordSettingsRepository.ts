import { DiscordSettings } from "@main/contexts/discord-notifications/domain/entities";

export interface IServerDiscordSettingsRepository {
  /** Defaults merged in; a missing or unreadable server_info.json yields the defaults. */
  get(serverId: string): DiscordSettings;
  /** Read-modify-write of server_info.json; throws if the server does not exist. */
  save(serverId: string, settings: DiscordSettings): void;
  /** Display name from server_info.json, falling back to the id. */
  serverName(serverId: string): string;
  /** Minecraft version from server_info.json (e.g. "1.21.4"), if known. */
  serverVersion(serverId: string): string | undefined;
}
