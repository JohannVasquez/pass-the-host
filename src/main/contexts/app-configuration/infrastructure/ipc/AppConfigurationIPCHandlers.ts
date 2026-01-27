import { ipcMain } from "electron";
import { Container } from "inversify";
import { TYPES } from "../../application/use-cases/types";
import {
  LoadConfigUseCase,
  SaveR2ConfigUseCase,
  SaveUsernameUseCase,
  SaveRamConfigUseCase,
  SaveLanguageUseCase,
} from "../../application/use-cases";

export function registerAppConfigurationIPCHandlers(container: Container): void {
  ipcMain.handle("config:load", async () => {
    const useCase = container.get<LoadConfigUseCase>(TYPES.LoadConfigUseCase);
    return useCase.execute();
  });

  ipcMain.handle("config:save-r2", async (_, r2Config) => {
    const useCase = container.get<SaveR2ConfigUseCase>(TYPES.SaveR2ConfigUseCase);
    return useCase.execute(r2Config);
  });

  ipcMain.handle("config:save-username", async (_, username) => {
    const useCase = container.get<SaveUsernameUseCase>(TYPES.SaveUsernameUseCase);
    return useCase.execute(username);
  });

  ipcMain.handle("config:save-ram", async (_, minRam, maxRam) => {
    const useCase = container.get<SaveRamConfigUseCase>(TYPES.SaveRamConfigUseCase);
    return useCase.execute(minRam, maxRam);
  });

  ipcMain.handle("config:save-language", async (_, language) => {
    const useCase = container.get<SaveLanguageUseCase>(TYPES.SaveLanguageUseCase);
    return useCase.execute(language);
  });
}
