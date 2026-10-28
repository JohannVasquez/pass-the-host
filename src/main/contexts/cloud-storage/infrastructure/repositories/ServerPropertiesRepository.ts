import { injectable } from "inversify";
import { app, BrowserWindow, dialog, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  IServerPropertiesRepository,
  WhitelistEntry,
  WorldActionResult,
} from "@main/contexts/cloud-storage/domain/repositories";
import { FileSystemError, ValidationError } from "@shared/domain/errors";

@injectable()
export class ServerPropertiesRepository implements IServerPropertiesRepository {
  readPort(serverId: string): number {
    const serverPath = this.getLocalServerPath(serverId);
    const propertiesPath = path.join(serverPath, "server.properties");

    try {
      if (!fs.existsSync(propertiesPath)) {
        return 25565;
      }

      const content = fs.readFileSync(propertiesPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("#") || trimmedLine === "") {
          continue;
        }

        if (trimmedLine.startsWith("server-port=")) {
          const portValue = trimmedLine.split("=")[1]?.trim();
          if (portValue) {
            const port = parseInt(portValue, 10);
            if (!isNaN(port) && port > 0 && port <= 65535) {
              return port;
            }
          }
        }
      }

      return 25565;
    } catch {
      // Expected case: file missing or unreadable, return default port
      return 25565;
    }
  }

  writePort(serverId: string, port: number): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const propertiesPath = path.join(serverPath, "server.properties");

    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ValidationError(`Invalid port number: ${port}. Port must be between 1 and 65535.`);
    }

    if (!fs.existsSync(propertiesPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(propertiesPath, "utf-8");
      const lines = content.split("\n");
      let portFound = false;

      const updatedLines = lines.map((line) => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("server-port=")) {
          portFound = true;
          return `server-port=${port}`;
        }

        return line;
      });

      if (!portFound) {
        updatedLines.push(`server-port=${port}`);
      }

      fs.writeFileSync(propertiesPath, updatedLines.join("\n"), "utf-8");
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to write server.properties for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  readAll(serverId: string): Record<string, string> {
    const propertiesPath = path.join(this.getLocalServerPath(serverId), "server.properties");
    if (!fs.existsSync(propertiesPath)) {
      return {};
    }

    const properties: Record<string, string> = {};
    for (const line of fs.readFileSync(propertiesPath, "utf-8").split(/\r?\n/)) {
      const entry = parsePropertyLine(line);
      if (entry) {
        properties[entry[0]] = entry[1];
      }
    }
    return properties;
  }

  writeAll(serverId: string, properties: Record<string, string>): boolean {
    const propertiesPath = path.join(this.getLocalServerPath(serverId), "server.properties");
    if (!fs.existsSync(propertiesPath)) {
      return false;
    }

    try {
      const pending = new Map(Object.entries(properties));
      const lines = fs
        .readFileSync(propertiesPath, "utf-8")
        .split(/\r?\n/)
        .map((line) => {
          const key = parsePropertyLine(line)?.[0];
          if (key === undefined || !pending.has(key)) {
            return line;
          }
          const value = pending.get(key) as string;
          pending.delete(key);
          return `${key}=${escapePropertyValue(value)}`;
        });

      // Drop the trailing empty line so appended keys don't leave a gap
      if (pending.size > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      for (const [key, value] of pending) {
        lines.push(`${key}=${escapePropertyValue(value)}`);
      }

      fs.writeFileSync(propertiesPath, lines.join("\n"), "utf-8");
      this.markLocalChanges(serverId);
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to write server.properties for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  readWhitelist(serverId: string): WhitelistEntry[] {
    const whitelistPath = path.join(this.getLocalServerPath(serverId), "whitelist.json");
    try {
      const entries = JSON.parse(fs.readFileSync(whitelistPath, "utf-8"));
      return Array.isArray(entries)
        ? entries
            .filter((e) => typeof e?.uuid === "string" && typeof e?.name === "string")
            .map((e) => ({ uuid: e.uuid, name: e.name }))
        : [];
    } catch {
      // Expected case: file missing (server never started) or malformed
      return [];
    }
  }

  writeWhitelist(serverId: string, entries: WhitelistEntry[]): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    if (!fs.existsSync(serverPath)) {
      return false;
    }

    try {
      const clean = entries.map(({ uuid, name }) => ({ uuid, name }));
      fs.writeFileSync(
        path.join(serverPath, "whitelist.json"),
        JSON.stringify(clean, null, 2),
        "utf-8",
      );
      this.markLocalChanges(serverId);
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to write whitelist.json for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async lookupPlayer(name: string, onlineMode: boolean): Promise<WhitelistEntry | null> {
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
      return null;
    }

    if (!onlineMode) {
      return { uuid: offlinePlayerUuid(name), name };
    }

    const response = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
    );
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Mojang API responded with ${response.status}`);
    }
    const profile = (await response.json()) as { id: string; name: string };
    return {
      uuid: profile.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5"),
      name: profile.name,
    };
  }

  async exportWorld(serverId: string): Promise<WorldActionResult> {
    const serverPath = this.getLocalServerPath(serverId);
    const levelName = this.readLevelName(serverId);
    const folders = this.worldFolders(serverPath, [levelName]);
    if (folders.length === 0) {
      return "no-world";
    }

    const { canceled, filePath } = await withParent((win) =>
      dialog.showSaveDialog(win, {
        defaultPath: path.join(app.getPath("downloads"), `${serverId}-${levelName}.zip`),
        filters: [{ name: "Zip", extensions: ["zip"] }],
      }),
    );
    if (canceled || !filePath) {
      return "canceled";
    }

    // zip appends to an existing archive instead of replacing it
    await fs.promises.rm(filePath, { force: true });
    const names = folders.map((folder) => path.basename(folder));
    // ponytail: system archivers (bsdtar on Windows 10+/macOS, zip on Linux) instead of a zip dependency
    if (process.platform === "linux") {
      await execFileAsync("zip", ["-r", "-q", filePath, ...names], { cwd: serverPath });
    } else {
      await execFileAsync("tar", ["-a", "-c", "-f", filePath, "-C", serverPath, ...names]);
    }
    shell.showItemInFolder(filePath);
    return "done";
  }

  async importWorld(serverId: string): Promise<WorldActionResult> {
    const savesPath = minecraftSavesPath();
    const { canceled, filePaths } = await withParent((win) =>
      dialog.showOpenDialog(win, {
        // A world is a folder, but Windows can't pick files and folders in one dialog:
        // picking its level.dat works everywhere
        properties: ["openFile"],
        defaultPath: fs.existsSync(savesPath) ? savesPath : undefined,
        filters: [{ name: "Minecraft world (.zip, level.dat)", extensions: ["zip", "dat"] }],
      }),
    );
    if (canceled || filePaths.length === 0) {
      return "canceled";
    }

    const picked = filePaths[0];
    const tempPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pass-the-host-world-"));
    try {
      let worldPath: string | null = null;
      if (picked.toLowerCase().endsWith(".zip")) {
        if (process.platform === "linux") {
          await execFileAsync("unzip", ["-q", picked, "-d", tempPath]);
        } else {
          await execFileAsync("tar", ["-x", "-f", picked, "-C", tempPath]);
        }
        worldPath = findWorldFolder(tempPath);
      } else if (path.basename(picked) === "level.dat") {
        worldPath = path.dirname(picked);
      }
      if (!worldPath) {
        return "invalid";
      }

      const serverPath = this.getLocalServerPath(serverId);
      const levelName = this.readLevelName(serverId);
      await this.deleteWorldFolders(serverPath, [levelName]);
      const target = path.join(serverPath, levelName);
      await fs.promises.cp(worldPath, target, { recursive: true });
      // Left behind by a client that had the world open
      await fs.promises.rm(path.join(target, "session.lock"), { force: true });
      this.markLocalChanges(serverId);
      return "done";
    } finally {
      await fs.promises.rm(tempPath, { recursive: true, force: true });
    }
  }

  async resetWorld(serverId: string, levelNames: string[]): Promise<WorldActionResult> {
    await this.deleteWorldFolders(this.getLocalServerPath(serverId), levelNames);
    this.markLocalChanges(serverId);
    return "done";
  }

  private readLevelName(serverId: string): string {
    return this.readAll(serverId)["level-name"] || "world";
  }

  // Vanilla, Forge and Fabric keep every dimension inside the world folder; Paper splits them out
  private worldFolders(serverPath: string, levelNames: string[]): string[] {
    return levelNames
      .flatMap((name) => [name, `${name}_nether`, `${name}_the_end`])
      .map((name) => path.resolve(serverPath, name))
      .filter((folder) => {
        // level-name comes from a user-editable file: never let "", "." or "../x" escape the server
        const relative = path.relative(serverPath, folder);
        return (
          relative !== "" &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative) &&
          fs.existsSync(path.join(folder, "level.dat"))
        );
      });
  }

  private async deleteWorldFolders(serverPath: string, levelNames: string[]): Promise<void> {
    for (const folder of this.worldFolders(serverPath, levelNames)) {
      await fs.promises.rm(folder, { recursive: true, force: true });
    }
  }

  // Keeps the next start from downloading the old cloud copy over these edits; the next upload clears it
  private markLocalChanges(serverId: string): void {
    fs.writeFileSync(
      path.join(this.getLocalServerPath(serverId), ".cloud-sync-state.json"),
      JSON.stringify(
        { localChangesPendingUpload: true, lastLocalChangeTimestamp: Date.now() },
        null,
        2,
      ),
      "utf-8",
    );
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}

const execFileAsync = promisify(execFile);

function withParent<T>(show: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return show(win);
}

function minecraftSavesPath(): string {
  if (process.platform === "win32") {
    return path.join(app.getPath("appData"), ".minecraft", "saves");
  }
  if (process.platform === "darwin") {
    return path.join(app.getPath("appData"), "minecraft", "saves");
  }
  return path.join(os.homedir(), ".minecraft", "saves");
}

/** Shallowest folder holding a level.dat (zips often wrap the world in one or two folders) */
export function findWorldFolder(root: string, depth = 3): string | null {
  let level = [root];
  for (let i = 0; i <= depth && level.length > 0; i++) {
    // Shortest path first, so "world" wins over Paper's "world_nether"
    const found = level
      .filter((dir) => fs.existsSync(path.join(dir, "level.dat")))
      .sort((a, b) => a.length - b.length)[0];
    if (found) {
      return found;
    }
    level = level.flatMap((dir) =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "__MACOSX")
        .map((entry) => path.join(dir, entry.name)),
    );
  }
  return null;
}

// server.properties is a Java .properties file: values escape ":", "=", "#", "!" and
// non-ASCII characters (e.g. "level-type=minecraft\:normal", "motd=§aHi").
function parsePropertyLine(line: string): [string, string] | null {
  const trimmed = line.trimStart();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) {
    return null;
  }
  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    return null;
  }
  return [
    trimmed.slice(0, separator).trim(),
    unescapePropertyValue(trimmed.slice(separator + 1).trimStart()),
  ];
}

function unescapePropertyValue(value: string): string {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, escaped: string) => {
    if (escaped.length === 5) return String.fromCharCode(parseInt(escaped.slice(1), 16));
    return { t: "\t", n: "\n", r: "\r", f: "\f" }[escaped] ?? escaped;
  });
}

function escapePropertyValue(value: string): string {
  return value
    .replace(/[\\:=#!]/g, "\\$&")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/^ /, "\\ ")
    .replace(/[^\x20-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

// Same UUID the server assigns in offline mode: v3 (MD5) of "OfflinePlayer:<name>"
function offlinePlayerUuid(name: string): string {
  const bytes = createHash("md5").update(`OfflinePlayer:${name}`, "utf8").digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes.toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}
