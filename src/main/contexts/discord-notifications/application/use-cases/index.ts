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

const BOT_NAME = "Pass the host";

export class RelayServerOutputUseCase {
  private buffers = new Map<string, LineBuffer>();

  constructor(
    private webhooks: IDiscordWebhookRepository,
    private loadSettings: (serverId: string) => DiscordSettings | Promise<DiscordSettings | undefined>,
    private serverName: (serverId: string) => string,
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
    let content: string;
    let username = BOT_NAME;
    switch (event.type) {
      case "chat": {
        const msg = sanitizeMentions(event.message);
        const name = discordUsername(event.player);
        if (name) username = name;
        content = truncate(name ? msg : `**${event.player}**: ${msg}`);
        break;
      }
      case "started":
        content = `🟢 **${server}** is online`;
        break;
      case "stopped":
        content =
          event.code !== null && event.code !== 0
            ? `⚠️ **${server}** stopped unexpectedly (exit code ${event.code})`
            : `🔴 **${server}** stopped`;
        break;
      case "joined":
        content = `➡️ **${event.player}** joined **${server}**`;
        break;
      case "left":
        content = `⬅️ **${event.player}** left **${server}**`;
        break;
    }
    this.webhooks.enqueue(url, { content, username, allowed_mentions: { parse: [] } });
  }
}

type StoppedEvent = { type: "stopped"; code: number | null };

export type DiscordTestResult =
  | { ok: true }
  | { ok: false; error: "invalid_url" | "failed"; detail?: string };

export class SendDiscordTestMessageUseCase {
  constructor(private webhooks: IDiscordWebhookRepository) {}

  async execute(url: string): Promise<DiscordTestResult> {
    const trimmed = url.trim();
    if (!isValidWebhookUrl(trimmed)) return { ok: false, error: "invalid_url" };
    try {
      await this.webhooks.sendNow(trimmed, {
        content: "✅ Pass the host is connected to this channel.",
        username: BOT_NAME,
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
