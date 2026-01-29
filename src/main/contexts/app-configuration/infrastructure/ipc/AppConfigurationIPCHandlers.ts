import { ipcMain } from "electron";
import { Container } from "inversify";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import { TYPES } from "../../application/use-cases/types";
import {
  LoadConfigUseCase,
  SaveR2ConfigUseCase,
  SaveUsernameUseCase,
  SaveRamConfigUseCase,
  SaveLanguageUseCase,
} from "../../application/use-cases";

export class AppConfigurationIPCHandlers {
  constructor(private readonly container: Container) {}

  public register(): void {
    ipcMain.handle(
      "config:load",
      this.handleIPC("loadConfig", async () => {
        const useCase = this.container.get<LoadConfigUseCase>(TYPES.LoadConfigUseCase);
        return useCase.execute();
      }),
    );

    ipcMain.handle(
      "config:save-r2",
      this.handleIPC("saveR2Config", async (_, r2Config) => {
        const useCase = this.container.get<SaveR2ConfigUseCase>(TYPES.SaveR2ConfigUseCase);
        return useCase.execute(r2Config);
      }),
    );

    ipcMain.handle(
      "config:save-username",
      this.handleIPC("saveUsername", async (_, username) => {
        const useCase = this.container.get<SaveUsernameUseCase>(TYPES.SaveUsernameUseCase);
        return useCase.execute(username);
      }),
    );

    ipcMain.handle(
      "config:save-ram",
      this.handleIPC("saveRamConfig", async (_, minRam, maxRam) => {
        const useCase = this.container.get<SaveRamConfigUseCase>(TYPES.SaveRamConfigUseCase);
        return useCase.execute(minRam, maxRam);
      }),
    );

    ipcMain.handle(
      "config:save-language",
      this.handleIPC("saveLanguage", async (_, language) => {
        const useCase = this.container.get<SaveLanguageUseCase>(TYPES.SaveLanguageUseCase);
        return useCase.execute(language);
      }),
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
        ErrorHandler.handle(error, `AppConfigurationIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }
}

export function registerAppConfigurationIPCHandlers(container: Container): void {
  const handlers = new AppConfigurationIPCHandlers(container);
  handlers.register();
}
