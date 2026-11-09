import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { ValidationError } from "@shared/domain/errors";
import { parsePackMcmeta } from "@main/contexts/mods/domain/parsePackMcmeta";
import { readZipEntries } from "@main/contexts/mods/infrastructure/readZipEntries";

export interface DatapackItem {
  name: string;
  isFolder: boolean;
  sizeBytes: number;
  /** null: no readable pack.mcmeta */
  description: string | null;
}

export interface DatapacksList {
  levelName: string;
  datapacks: DatapackItem[];
}

export type AddDatapacksResult =
  { canceled: true } | { canceled?: false; added: string[]; rejected: string[] };

export class DatapacksRepository {
  list(serverId: string): DatapacksList {
    const { levelName, dir } = this.datapacksDir(serverId);
    if (!fs.existsSync(dir)) return { levelName, datapacks: [] };
    const datapacks = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || (e.isFile() && e.name.toLowerCase().endsWith(".zip")))
      .map((e): DatapackItem => {
        const full = path.join(dir, e.name);
        const isFolder = e.isDirectory();
        let description: string | null = null;
        try {
          const raw = isFolder
            ? fs.readFileSync(path.join(full, "pack.mcmeta"))
            : readZipEntries(full, ["pack.mcmeta"]).get("pack.mcmeta");
          description = raw ? (parsePackMcmeta(raw.toString("utf-8"))?.description ?? null) : null;
        } catch {
          // Unreadable pack: listed without a description
        }
        let sizeBytes = 0;
        try {
          sizeBytes = isFolder ? 0 : fs.statSync(full).size;
        } catch {
          // Size stays 0
        }
        return { name: e.name, isFolder, sizeBytes, description };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { levelName, datapacks };
  }

  async add(serverId: string, filePaths?: string[]): Promise<AddDatapacksResult> {
    const { dir } = this.datapacksDir(serverId);
    let files = filePaths ?? [];
    if (files.length === 0) {
      const { canceled, filePaths: picked } = await withParent((win) =>
        dialog.showOpenDialog(win, {
          properties: ["openFile", "multiSelections"],
          filters: [{ name: "Datapacks (.zip)", extensions: ["zip"] }],
        }),
      );
      if (canceled || picked.length === 0) return { canceled: true };
      files = picked;
    }

    const taken = new Set(
      fs.existsSync(dir) ? fs.readdirSync(dir).map((n) => n.toLowerCase()) : [],
    );
    const result = { added: [] as string[], rejected: [] as string[] };
    for (const filePath of files) {
      const original = path.basename(filePath);
      if (!isDatapackZip(filePath)) {
        result.rejected.push(original);
        continue;
      }
      await fs.promises.mkdir(dir, { recursive: true });
      const name = uniqueName(original, taken);
      await fs.promises.copyFile(filePath, path.join(dir, name));
      taken.add(name.toLowerCase());
      result.added.push(name);
    }
    if (result.added.length > 0) this.markLocalChanges(serverId);
    return result;
  }

  remove(serverId: string, name: string): boolean {
    // Trust boundary: the renderer must only name a plain entry of the datapacks folder
    if (
      typeof name !== "string" ||
      name === "" ||
      name === "." ||
      name === ".." ||
      path.basename(name) !== name ||
      name.includes("\\")
    ) {
      throw new ValidationError(`Invalid datapack name: ${name}`);
    }
    const target = path.join(this.datapacksDir(serverId).dir, name);
    if (!fs.existsSync(target)) return false;
    fs.rmSync(target, { recursive: true, force: true });
    this.markLocalChanges(serverId);
    return true;
  }

  private datapacksDir(serverId: string): { levelName: string; dir: string } {
    const serverPath = this.serverPath(serverId);
    let levelName = "world";
    try {
      const props = fs.readFileSync(path.join(serverPath, "server.properties"), "utf-8");
      const line = props.split(/\r?\n/).find((l) => /^\s*level-name\s*=/.test(l));
      levelName = line?.slice(line.indexOf("=") + 1).trim() || "world";
    } catch {
      // No server.properties yet: the default world name
    }
    const dir = path.resolve(serverPath, levelName, "datapacks");
    // level-name comes from a user-editable file: never let "..", "../x" or an absolute path escape the server
    const relative = path.relative(serverPath, path.resolve(serverPath, levelName));
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new ValidationError(`Invalid level-name: ${levelName}`);
    }
    return { levelName, dir };
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

function isDatapackZip(filePath: string): boolean {
  if (typeof filePath !== "string" || !filePath.toLowerCase().endsWith(".zip")) return false;
  try {
    const raw = readZipEntries(filePath, ["pack.mcmeta"]).get("pack.mcmeta");
    return !!raw && parsePackMcmeta(raw.toString("utf-8")) !== null;
  } catch {
    return false;
  }
}

function withParent<T>(show: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return show(win);
}

/** "a.zip" -> "a-1.zip" -> "a-2.zip" until it doesn't collide (case-insensitive) */
function uniqueName(fileName: string, taken: Set<string>): string {
  if (!taken.has(fileName.toLowerCase())) return fileName;
  const base = fileName.replace(/\.zip$/i, "");
  for (let i = 1; ; i++) {
    const candidate = `${base}-${i}.zip`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
