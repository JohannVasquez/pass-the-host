import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { ValidationError } from "@shared/domain/errors";
import {
  MOD_METADATA_ENTRIES,
  ModMetadata,
  parseModMetadata,
} from "@main/contexts/mods/domain/parseModMetadata";
import {
  checkModCompatibility,
  ModCompat,
  ModFolder,
  targetFolder,
} from "@main/contexts/mods/domain/checkModCompatibility";
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
  /** Where the jar lives: client-mods is stored (and synced) with the server but never loaded by it */
  folder: ModFolder;
  /** SHA1 of the jar, when it could be read */
  sha1?: string;
  /** Modrinth CDN URL of this exact file, when Modrinth has it */
  downloadUrl?: string;
}

export interface ModsList {
  serverName: string;
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
  name?: string;
  engine: string;
  minecraftVersion: string;
  loaderVersion?: string;
}

export class ModsRepository {
  async list(serverId: string): Promise<ModsList> {
    const info = this.readServerInfo(serverId);
    const folder = this.folderName(info.engine);
    return { ...info, serverName: info.name ?? serverId, folder, mods: await this.installed(serverId, info) };
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

    // mod id -> installed file, kept up to date as files land
    const byId = new Map<string, { fileName: string; folder: ModFolder }>();
    const taken: Record<ModFolder, Set<string>> = {
      mods: new Set(),
      plugins: new Set(),
      "client-mods": new Set(),
    };
    for (const mod of await this.installed(serverId, info)) {
      taken[mod.folder].add(mod.fileName.toLowerCase());
      if (mod.metadata) byId.set(mod.metadata.id, { fileName: mod.fileName, folder: mod.folder });
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

      const folder = targetFolder(item.side, info.engine);
      const dir = this.dirOf(serverId, folder);
      await fs.promises.mkdir(dir, { recursive: true });
      // The same mod may sit in either folder: replace it where it is
      const previous = item.metadata ? byId.get(item.metadata.id) : undefined;
      if (previous) {
        await fs.promises.rm(path.join(this.dirOf(serverId, previous.folder), previous.fileName), {
          force: true,
        });
        taken[previous.folder].delete(previous.fileName.toLowerCase());
      }
      const fileName = uniqueName(item.fileName, taken[folder]);
      await fs.promises.copyFile(filePath, path.join(dir, fileName));
      taken[folder].add(fileName.toLowerCase());
      if (item.metadata) byId.set(item.metadata.id, { fileName, folder });
      const compat = checkModCompatibility(item.metadata, info.engine, info.minecraftVersion, folder);
      (previous ? result.replaced : result.added).push({ ...item, fileName, folder, compat });
    }

    if (result.added.length > 0 || result.replaced.length > 0) {
      this.markLocalChanges(serverId);
    }
    return result;
  }

  remove(serverId: string, fileName: string, folder: ModFolder): boolean {
    assertJarName(fileName);
    const info = this.readServerInfo(serverId);
    const target = path.join(this.checkedDir(serverId, info.engine, folder), fileName);
    if (!fs.existsSync(target)) {
      return false;
    }
    fs.rmSync(target, { force: true });
    this.markLocalChanges(serverId);
    return true;
  }

  /** Moves jars between mods/ and client-mods/; returns how many moved */
  move(serverId: string, fileNames: string[], from: ModFolder, to: ModFolder): number {
    if (!Array.isArray(fileNames)) throw new ValidationError("Invalid mod file list");
    fileNames.forEach(assertJarName);
    const info = this.readServerInfo(serverId);
    const source = this.checkedDir(serverId, info.engine, from);
    const dest = this.checkedDir(serverId, info.engine, to);
    if (from === to) throw new ValidationError("Source and destination folders are the same");
    fs.mkdirSync(dest, { recursive: true });
    const taken = new Set(fs.readdirSync(dest).map((n) => n.toLowerCase()));
    let moved = 0;
    for (const fileName of fileNames) {
      const src = path.join(source, fileName);
      if (!fs.existsSync(src)) continue;
      const name = uniqueName(fileName, taken);
      fs.renameSync(src, path.join(dest, name));
      taken.add(name.toLowerCase());
      moved++;
    }
    if (moved > 0) this.markLocalChanges(serverId);
    return moved;
  }

  private async installed(serverId: string, info: ServerInfo): Promise<ModItem[]> {
    const folders: ModFolder[] = [this.folderName(info.engine)];
    if (info.engine !== "paper") folders.push("client-mods");
    const jars = folders.flatMap((folder) => {
      const dir = this.dirOf(serverId, folder);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".jar"))
        .map((entry) => ({ jar: path.join(dir, entry.name), folder }));
    });
    const hashes = new Map<string, string>();
    const modrinth = await lookupModrinth(
      jars.map((j) => j.jar),
      undefined,
      hashes,
    );
    return jars
      .map(({ jar, folder }) => this.inspectFile(jar, info, modrinth, folder, hashes.get(jar)))
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
    folder: ModFolder = this.folderName(info.engine),
    sha1?: string,
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
      compat: checkModCompatibility(metadata, info.engine, info.minecraftVersion, folder),
      folder,
      side,
      sideSource: known ? "modrinth" : "jar",
      ...(known && { modrinth: { slug: known.slug, title: known.title } }),
      ...(sha1 && { sha1 }),
      ...(known?.downloadUrl && { downloadUrl: known.downloadUrl }),
    };
  }

  private readServerInfo(serverId: string): ServerInfo {
    const infoPath = path.join(this.serverPath(serverId), "server_info.json");
    try {
      const raw = JSON.parse(fs.readFileSync(infoPath, "utf-8")) as Record<string, unknown>;
      return {
        name: typeof raw.name === "string" && raw.name ? raw.name : undefined,
        engine: typeof raw.type === "string" ? raw.type : "vanilla",
        minecraftVersion: typeof raw.version === "string" ? raw.version : "",
        loaderVersion: typeof raw.loaderVersion === "string" ? raw.loaderVersion : undefined,
      };
    } catch {
      throw new ValidationError(`Server ${serverId} has no readable server_info.json`);
    }
  }

  /** Absolute path of an installed jar, for reading it back (host side of mod sync) */
  jarPath(serverId: string, folder: ModFolder, fileName: string): string {
    assertJarName(fileName);
    return path.join(this.checkedDir(serverId, this.readServerInfo(serverId).engine, folder), fileName);
  }

  /** Absolute mod folders this server has (mods/ + client-mods/, or plugins/) */
  modDirs(serverId: string): string[] {
    const engine = this.readServerInfo(serverId).engine;
    return (engine === "paper" ? ["plugins"] : ["mods", "client-mods"]).map((f) =>
      this.dirOf(serverId, f as ModFolder),
    );
  }

  private folderName(engine: string): "mods" | "plugins" {
    return engine === "paper" ? "plugins" : "mods";
  }

  private dirOf(serverId: string, folder: ModFolder): string {
    return path.join(this.serverPath(serverId), folder);
  }

  // Trust boundary: the renderer only names folders this engine really has
  private checkedDir(serverId: string, engine: string, folder: ModFolder): string {
    const allowed: ModFolder[] = engine === "paper" ? ["plugins"] : ["mods", "client-mods"];
    if (!allowed.includes(folder)) throw new ValidationError(`Invalid mods folder: ${folder}`);
    return this.dirOf(serverId, folder);
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

// Trust boundary: the renderer must only name a plain jar
function assertJarName(fileName: string): void {
  if (
    typeof fileName !== "string" ||
    path.basename(fileName) !== fileName ||
    fileName === ".." ||
    fileName.includes("\\") ||
    !fileName.toLowerCase().endsWith(".jar")
  ) {
    throw new ValidationError(`Invalid mod file name: ${fileName}`);
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
