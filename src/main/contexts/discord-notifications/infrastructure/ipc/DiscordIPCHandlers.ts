import { ipcMain } from "electron";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import {
  GetServerDiscordSettingsUseCase,
  SaveServerDiscordSettingsUseCase,
  SendDiscordTestMessageUseCase,
} from "@main/contexts/discord-notifications/application/use-cases";
import { DiscordLinkService } from "@main/contexts/discord-notifications/application/DiscordLinkService";
import { DiscordSettings } from "@main/contexts/discord-notifications/domain/entities";

export class DiscordIPCHandlers {
  constructor(
    private sendTest: SendDiscordTestMessageUseCase,
    private getSettings: GetServerDiscordSettingsUseCase,
    private saveSettings: SaveServerDiscordSettingsUseCase,
    private links: DiscordLinkService,
  ) {}

  register(): void {
    ipcMain.handle("discord:send-test", async (_event, url: string, language?: unknown) => {
      if (typeof url !== "string") return { ok: false, error: "invalid_url" };
      return this.sendTest.execute(url, typeof language === "string" ? language : undefined);
    });

    ipcMain.handle(
      "discord:get-settings",
      this.handleIPC("getSettings", async (_, serverId: string) =>
        this.getSettings.execute(serverId),
      ),
    );

    ipcMain.handle(
      "discord:save-settings",
      this.handleIPC("saveSettings", async (_, serverId: string, settings: DiscordSettings) =>
        this.saveSettings.execute(serverId, settings),
      ),
    );

    // Errors reach the renderer as the Worker's error code (Error.message)
    ipcMain.handle(
      "discord:start-link",
      this.handleIPC("startLink", async (_, serverId: string) => this.links.startLink(serverId)),
    );
    ipcMain.handle(
      "discord:link-state",
      this.handleIPC("getLinkState", async (_, serverId: string) =>
        this.links.getLinkState(serverId),
      ),
    );
    ipcMain.handle(
      "discord:list-channels",
      this.handleIPC("listChannels", async (_, serverId: string) =>
        this.links.listChannels(serverId),
      ),
    );
    ipcMain.handle(
      "discord:select-channel",
      this.handleIPC("selectChannel", async (_, serverId: string, channelId: string) =>
        this.links.selectChannel(serverId, channelId),
      ),
    );
    ipcMain.handle(
      "discord:unlink",
      this.handleIPC("unlink", async (_, serverId: string) => this.links.unlink(serverId)),
    );
  }

  private handleIPC<T extends unknown[], R>(
    context: string,
    handler: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await handler(...args);
      } catch (error) {
        ErrorHandler.handle(error, `DiscordIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }
}
