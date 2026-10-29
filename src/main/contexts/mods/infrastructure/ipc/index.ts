import { ipcMain, shell } from "electron";
import type { ModFolder } from "@main/contexts/mods/domain/checkModCompatibility";
import { ModSync, ClientMod, ClientModManifest } from "@main/contexts/mods/infrastructure/ModSync";
import { ModsRepository } from "@main/contexts/mods/infrastructure/ModsRepository";

export function registerModsIPCHandlers(): void {
  const repository = new ModsRepository();
  const sync = new ModSync(repository);

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
