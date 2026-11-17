import { ipcMain } from "electron";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import {
  GetServerDiscordSettingsUseCase,
  SaveServerDiscordSettingsUseCase,
  SendDiscordTestMessageUseCase,
} from "@main/contexts/discord-notifications/application/use-cases";
import { DiscordSettings } from "@main/contexts/discord-notifications/domain/entities";

export class DiscordIPCHandlers {
  constructor(
    private sendTest: SendDiscordTestMessageUseCase,
    private getSettings: GetServerDiscordSettingsUseCase,
    private saveSettings: SaveServerDiscordSettingsUseCase,
  ) {}

  register(): void {
    ipcMain.handle("discord:send-test", async (_event, url: string) => {
      if (typeof url !== "string") return { ok: false, error: "invalid_url" };
      return this.sendTest.execute(url);
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
