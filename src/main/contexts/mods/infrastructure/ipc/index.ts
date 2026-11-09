import { ipcMain, shell } from "electron";
import type { ModFolder } from "@main/contexts/mods/domain/checkModCompatibility";
import { ModSync, ClientMod, ClientModManifest } from "@main/contexts/mods/infrastructure/ModSync";
import { DatapacksRepository } from "@main/contexts/mods/infrastructure/DatapacksRepository";
import { ModsRepository } from "@main/contexts/mods/infrastructure/ModsRepository";

export function registerModsIPCHandlers(): void {
  const repository = new ModsRepository();
  const sync = new ModSync(repository);
  const datapacks = new DatapacksRepository();

  ipcMain.handle("datapacks:list", (_event, serverId: string) => datapacks.list(serverId));
  ipcMain.handle("datapacks:add", (_event, serverId: string, filePaths?: string[]) =>
    datapacks.add(serverId, filePaths),
  );
  ipcMain.handle("datapacks:remove", (_event, serverId: string, name: string) =>
    datapacks.remove(serverId, name),
  );

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

  ipcMain.handle("mods:client-manifest", (_event, serverId: string) => sync.clientManifest(serverId));
  ipcMain.handle("mods:fingerprint", (_event, serverId: string) => sync.modsFingerprint(serverId));
  ipcMain.handle("mods:read-client-mod", (_event, serverId: string, sha1: string) =>
    sync.readClientMod(serverId, sha1),
  );
  ipcMain.handle("mods:get-sync-folder", () => sync.getSyncFolder());
  ipcMain.handle("mods:pick-sync-folder", () => sync.pickSyncFolder());
  ipcMain.handle("mods:reset-sync-folder", () => sync.resetSyncFolder());
  ipcMain.handle("mods:plan-sync", (_event, manifest: ClientModManifest) => sync.planSync(manifest));
  ipcMain.handle("mods:download-modrinth-mod", (_event, mod: ClientMod) =>
    sync.downloadModrinthMod(mod),
  );
  ipcMain.handle("mods:write-synced-mod", (_event, mod: ClientMod, data: Uint8Array) =>
    sync.writeSyncedMod(mod, data),
  );
  ipcMain.handle("mods:finish-sync", (_event, manifest: ClientModManifest) =>
    sync.finishSync(manifest),
  );
}
