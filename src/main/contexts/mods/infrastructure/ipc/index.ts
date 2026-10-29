import { ipcMain, shell } from "electron";
import type { ModFolder } from "@main/contexts/mods/domain/checkModCompatibility";
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
  ipcMain.handle("mods:open-modrinth", (_event, slug: string) => {
    // Trust boundary: only a plain slug may build the URL
    if (typeof slug !== "string" || !/^[\w-]+$/.test(slug)) return false;
    shell.openExternal(`https://modrinth.com/mod/${slug}`);
    return true;
  });
  ipcMain.handle("mods:remove", (_event, serverId: string, fileName: string, folder: ModFolder) =>
    repository.remove(serverId, fileName, folder),
  );
  ipcMain.handle(
    "mods:move",
    (_event, serverId: string, fileNames: string[], from: ModFolder, to: ModFolder) =>
      repository.move(serverId, fileNames, from, to),
  );
}
