import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { ValidationError } from "@shared/domain/errors";
import {
  MOD_METADATA_ENTRIES,
  ModMetadata,
  parseModMetadata,
} from "@main/contexts/mods/domain/parseModMetadata";
import { checkModCompatibility, ModCompat } from "@main/contexts/mods/domain/checkModCompatibility";
import { readZipEntries } from "@main/contexts/mods/infrastructure/readZipEntries";
import {
  lookupModrinth,
  metadataFromModrinth,
  ModrinthInfo,
  sideFromModrinth,
} from "@main/contexts/mods/infrastructure/modrinthLookup";

export interface ModItem {
  fileName: string;
  sizeBytes: number;
  metadata: ModMetadata | null;
  compat: ModCompat;
  /** Who has to install it, from Modrinth when it knows the file, else from the jar itself */
  side: "client" | "server" | "both";
  sideSource: "modrinth" | "jar";
  modrinth?: { slug: string; title: string };
}

export interface ModsList {
  engine: string;
  minecraftVersion: string;
  loaderVersion?: string;
  folder: "mods" | "plugins";
  mods: ModItem[];
}

export type AddModsResult =
  | { canceled: true }
  | { canceled?: false; added: ModItem[]; replaced: ModItem[]; rejected: ModItem[] };

interface ServerInfo {
  engine: string;
  minecraftVersion: string;
  loaderVersion?: string;
}

export class ModsRepository {
  async list(serverId: string): Promise<ModsList> {
    const info = this.readServerInfo(serverId);
    const folder = this.folderName(info.engine);
    return { ...info, folder, mods: await this.installed(serverId, info) };
  }

  async inspect(serverId: string, filePaths: string[]): Promise<ModItem[]> {
    const info = this.readServerInfo(serverId);
    const modrinth = await lookupModrinth(filePaths);
    return filePaths.map((filePath) => this.inspectFile(filePath, info, modrinth));
  }

  async add(serverId: string, filePaths?: string[]): Promise<AddModsResult> {
    const info = this.readServerInfo(serverId);
    let files = filePaths ?? [];
    if (files.length === 0) {
      const { canceled, filePaths: picked } = await withParent((win) =>
        dialog.showOpenDialog(win, {
          properties: ["openFile", "multiSelections"],
          filters: [{ name: "Mods (.jar)", extensions: ["jar"] }],
        }),
      );
      if (canceled || picked.length === 0) {
        return { canceled: true };
      }
      files = picked;
    }

    const dir = this.modsDir(serverId, info.engine);
    await fs.promises.mkdir(dir, { recursive: true });
    // mod id -> installed file name, kept up to date as files land
    const byId = new Map<string, string>();
    const taken = new Set<string>();
    for (const mod of await this.installed(serverId, info)) {
      taken.add(mod.fileName.toLowerCase());
      if (mod.metadata) byId.set(mod.metadata.id, mod.fileName);
    }

    const modrinth = await lookupModrinth(files);
    const result = { added: [] as ModItem[], replaced: [] as ModItem[], rejected: [] as ModItem[] };
    for (const filePath of files) {
      const item = this.inspectFile(filePath, info, modrinth);
      const reason = item.compat.status === "error" ? item.compat.reason : null;
      if (!filePath.toLowerCase().endsWith(".jar") || reason === "wrong_loader") {
        result.rejected.push(item);
        continue;
      }

      const previous = item.metadata ? byId.get(item.metadata.id) : undefined;
      if (previous) {
        await fs.promises.rm(path.join(dir, previous), { force: true });
        taken.delete(previous.toLowerCase());
      }
      const fileName = uniqueName(item.fileName, taken);
      await fs.promises.copyFile(filePath, path.join(dir, fileName));
      taken.add(fileName.toLowerCase());
      if (item.metadata) byId.set(item.metadata.id, fileName);
      (previous ? result.replaced : result.added).push({ ...item, fileName });
    }

    if (result.added.length > 0 || result.replaced.length > 0) {
      this.markLocalChanges(serverId);
    }
    return result;
  }

  remove(serverId: string, fileName: string): boolean {
    // Trust boundary: the renderer must only name a plain jar inside the mods folder
    if (
      typeof fileName !== "string" ||
      path.basename(fileName) !== fileName ||
      fileName === ".." ||
      fileName.includes("\\") ||
      !fileName.toLowerCase().endsWith(".jar")
    ) {
      throw new ValidationError(`Invalid mod file name: ${fileName}`);
    }
    const info = this.readServerInfo(serverId);
    const target = path.join(this.modsDir(serverId, info.engine), fileName);
    if (!fs.existsSync(target)) {
      return false;
    }
    fs.rmSync(target, { force: true });
    this.markLocalChanges(serverId);
    return true;
  }

  private async installed(serverId: string, info: ServerInfo): Promise<ModItem[]> {
    const dir = this.modsDir(serverId, info.engine);
    if (!fs.existsSync(dir)) {
      return [];
    }
    const jars = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".jar"))
      .map((entry) => path.join(dir, entry.name));
    const modrinth = await lookupModrinth(jars);
    return jars
      .map((jar) => this.inspectFile(jar, info, modrinth))
      .sort((a, b) =>
        (a.metadata?.name ?? a.fileName).localeCompare(b.metadata?.name ?? b.fileName, undefined, {
          sensitivity: "base",
        }),
      );
  }

  private inspectFile(
    filePath: string,
    info: ServerInfo,
    modrinthInfo: Map<string, ModrinthInfo>,
  ): ModItem {
    let metadata: ModMetadata | null = null;
    try {
      metadata = parseModMetadata(readZipEntries(filePath, MOD_METADATA_ENTRIES));
    } catch {
      // Expected case: not a zip or corrupt, reported as not_a_mod
    }
    const known = modrinthInfo.get(filePath);
    // Libraries (Kotlin for Forge, Essential) carry no metadata but Modrinth knows them
    if (!metadata && known) {
      const fallback = metadataFromModrinth(known);
      if (fallback.loaders.length > 0) metadata = fallback;
    }
    const side = known ? sideFromModrinth(known) : (metadata?.side ?? "both");
    if (metadata) metadata = { ...metadata, side };
    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(filePath).size;
    } catch {
      // Unreadable file: size stays 0, the metadata is null too
    }
    return {
      fileName: path.basename(filePath),
      sizeBytes,
      metadata,
      compat: checkModCompatibility(metadata, info.engine, info.minecraftVersion),
      side,
      sideSource: known ? "modrinth" : "jar",
      ...(known && { modrinth: { slug: known.slug, title: known.title } }),
    };
  }

  private readServerInfo(serverId: string): ServerInfo {
    const infoPath = path.join(this.serverPath(serverId), "server_info.json");
    try {
      const raw = JSON.parse(fs.readFileSync(infoPath, "utf-8")) as Record<string, unknown>;
      return {
        engine: typeof raw.type === "string" ? raw.type : "vanilla",
        minecraftVersion: typeof raw.version === "string" ? raw.version : "",
        loaderVersion: typeof raw.loaderVersion === "string" ? raw.loaderVersion : undefined,
      };
    } catch {
      throw new ValidationError(`Server ${serverId} has no readable server_info.json`);
    }
  }

  private folderName(engine: string): "mods" | "plugins" {
    return engine === "paper" ? "plugins" : "mods";
  }

  private modsDir(serverId: string, engine: string): string {
    return path.join(this.serverPath(serverId), this.folderName(engine));
  }

  private serverPath(serverId: string): string {
    if (
      typeof serverId !== "string" ||
      serverId === "" ||
      serverId === "." ||
      serverId === ".." ||
      path.basename(serverId) !== serverId ||
      serverId.includes("\\")
    ) {
      throw new ValidationError(`Invalid server id: ${serverId}`);
    }
    return path.join(app.getPath("userData"), "servers", serverId);
  }

  // Keeps the next start from downloading the old cloud copy over these edits; the next upload clears it
  private markLocalChanges(serverId: string): void {
    fs.writeFileSync(
      path.join(this.serverPath(serverId), ".cloud-sync-state.json"),
      JSON.stringify(
        { localChangesPendingUpload: true, lastLocalChangeTimestamp: Date.now() },
        null,
        2,
      ),
      "utf-8",
    );
  }
}

function withParent<T>(show: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return show(win);
}

/** "a.jar" -> "a-1.jar" -> "a-2.jar" until it doesn't collide (case-insensitive) */
function uniqueName(fileName: string, taken: Set<string>): string {
  if (!taken.has(fileName.toLowerCase())) return fileName;
  const base = fileName.replace(/\.jar$/i, "");
  for (let i = 1; ; i++) {
    const candidate = `${base}-${i}.jar`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
