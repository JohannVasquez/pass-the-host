import { ipcMain } from "electron";
import { ModsRepository } from "@main/contexts/mods/infrastructure/ModsRepository";

export function registerModsIPCHandlers(): void {
  const repository = new ModsRepository();

  ipcMain.handle("mods:list", (_event, serverId: string) => repository.list(serverId));
  ipcMain.handle("mods:inspect", (_event, serverId: string, filePaths: string[]) =>
    repository.inspect(serverId, filePaths),
  );
  ipcMain.handle("mods:add", (_event, serverId: string, filePaths?: string[]) =>
    repository.add(serverId, filePaths),
  );
  ipcMain.handle("mods:remove", (_event, serverId: string, fileName: string) =>
    repository.remove(serverId, fileName),
  );
}
