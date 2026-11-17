import { logger } from "@shared/infrastructure/logger";
import { DiscordSettings } from "@main/contexts/discord-notifications/domain/entities";
import {
  IDiscordWebhookRepository,
  IServerDiscordSettingsRepository,
} from "@main/contexts/discord-notifications/domain/repositories";
import {
  LineBuffer,
  ServerEvent,
  discordUsername,
  isValidWebhookUrl,
  parseServerLine,
  sanitizeMentions,
  truncate,
} from "@main/contexts/discord-notifications/domain/serverLog";
import {
  discordMessages,
  safeNickname,
} from "@main/contexts/discord-notifications/domain/messages";

const BOT_NAME = "Pass the host";
// Served from R2 (media.jvdev.cl); Discord caches avatars, so this is fetched rarely
const BOT_AVATAR = "https://media.jvdev.cl/icon/discord-avatar.png";
// Skin head by player name (player names are already [A-Za-z0-9_]); unknown names get Steve
const playerAvatar = (player: string): string => `https://mc-heads.net/avatar/${player}/128`;

export class RelayServerOutputUseCase {
  private buffers = new Map<string, LineBuffer>();

  constructor(
    private webhooks: IDiscordWebhookRepository,
    private loadSettings: (serverId: string) => DiscordSettings | Promise<DiscordSettings | undefined>,
    private serverName: (serverId: string) => string,
    /** Nickname saved in the app: this PC is the one hosting, so it started/stopped the server */
    private hostNickname: () => Promise<string | null | undefined> = async () => undefined,
  ) {}

  onOutput(serverId: string, stream: "stdout" | "stderr", chunk: string): void {
    try {
      const key = `${serverId}:${stream}`;
      let buf = this.buffers.get(key);
      if (!buf) this.buffers.set(key, (buf = new LineBuffer()));
      this.handleLines(serverId, buf.push(chunk));
    } catch (e) {
      logger.error("Discord relay failed", e);
    }
  }

  onExit(serverId: string, code: number | null): void {
    try {
      for (const stream of ["stdout", "stderr"]) {
        const key = `${serverId}:${stream}`;
        const lines = this.buffers.get(key)?.flush() ?? [];
        this.buffers.delete(key);
        this.handleLines(serverId, lines);
      }
      this.dispatch(serverId, { type: "stopped", code });
    } catch (e) {
      logger.error("Discord relay failed", e);
    }
  }

  private handleLines(serverId: string, lines: string[]): void {
    for (const line of lines) {
      const event = parseServerLine(line);
      if (event) this.dispatch(serverId, event);
    }
  }

  private dispatch(serverId: string, event: ServerEvent | StoppedEvent): void {
    this.process(serverId, event).catch((e) => logger.error("Discord relay failed", e));
  }

  private async process(serverId: string, event: ServerEvent | StoppedEvent): Promise<void> {
    const s = await this.loadSettings(serverId);
    const url = s?.webhook_url?.trim() ?? "";
    if (!isValidWebhookUrl(url)) return;
    const enabled =
      event.type === "chat"
        ? (s?.relay_chat ?? true)
        : event.type === "started" || event.type === "stopped"
          ? (s?.notify_status ?? true)
          : (s?.notify_joins ?? false);
    if (!enabled) return;

    const server = this.serverName(serverId);
    const m = discordMessages(s?.language);
    const by =
      event.type === "started" || event.type === "stopped"
        ? safeNickname(await this.hostNickname().catch(() => undefined))
        : undefined;
    let content: string;
    let username = BOT_NAME;
    let avatar = BOT_AVATAR;
    switch (event.type) {
      case "chat": {
        const msg = sanitizeMentions(event.message);
        const name = discordUsername(event.player);
        if (name) username = name;
        avatar = playerAvatar(event.player);
        content = truncate(name ? msg : `**${event.player}**: ${msg}`);
        break;
      }
      case "started":
        content = m.online(server, by);
        break;
      case "stopped":
        content =
          event.code !== null && event.code !== 0
            ? m.crashed(server, event.code, by)
            : m.stopped(server, by);
        break;
      case "joined":
        content = m.joined(event.player, server);
        break;
      case "left":
        content = m.left(event.player, server);
        break;
    }
    this.webhooks.enqueue(url, {
      content,
      username,
      avatar_url: avatar,
      allowed_mentions: { parse: [] },
    });
  }
}

type StoppedEvent = { type: "stopped"; code: number | null };

export type DiscordTestResult =
  | { ok: true }
  | { ok: false; error: "invalid_url" | "failed"; detail?: string };

export class SendDiscordTestMessageUseCase {
  constructor(private webhooks: IDiscordWebhookRepository) {}

  async execute(url: string, language?: string): Promise<DiscordTestResult> {
    const trimmed = url.trim();
    if (!isValidWebhookUrl(trimmed)) return { ok: false, error: "invalid_url" };
    try {
      await this.webhooks.sendNow(trimmed, {
        content: discordMessages(language).test(),
        username: BOT_NAME,
        avatar_url: BOT_AVATAR,
        allowed_mentions: { parse: [] },
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "failed", detail: e instanceof Error ? e.message : undefined };
    }
  }
}

export class GetServerDiscordSettingsUseCase {
  constructor(private settings: IServerDiscordSettingsRepository) {}

  execute(serverId: string): DiscordSettings {
    return this.settings.get(serverId);
  }
}

export class SaveServerDiscordSettingsUseCase {
  constructor(private settings: IServerDiscordSettingsRepository) {}

  execute(serverId: string, settings: DiscordSettings): void {
    this.settings.save(serverId, settings);
  }
}
