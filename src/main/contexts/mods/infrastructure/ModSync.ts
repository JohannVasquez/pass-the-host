import * as crypto from "crypto";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { ValidationError } from "@shared/domain/errors";
import { getUserAgent } from "@main/contexts/server-lifecycle/infrastructure/repositories/EngineCatalog";
import { isModrinthCdnUrl, sha1File } from "@main/contexts/mods/infrastructure/modrinthLookup";
import type { ModsRepository } from "@main/contexts/mods/infrastructure/ModsRepository";

export interface ClientMod {
  sha1: string;
  fileName: string;
  size: number;
  name: string;
  side: "client" | "both";
  url?: string;
}

export interface ClientModManifest {
  serverName: string;
  engine: string;
  minecraftVersion: string;
  loaderVersion?: string;
  mods: ClientMod[];
}

export interface SyncPlan {
  folder: string;
  download: ClientMod[];
  remove: string[];
  upToDate: number;
}

export const STATE_FILE = ".passthehost-mods.json";
export const MAX_MOD_BYTES = 512 * 1024 * 1024;
const MAX_MODS = 2000;
const MAX_KEY = 300;
const MANIFEST_TTL_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

type Managed = Record<string, string>; // fileName -> sha1
interface SyncState {
  managed: Managed;
  server: string;
  updatedAt: number;
}

// ---- validation (the manifest comes from another person's computer) ----

export function assertSyncFileName(fileName: unknown): asserts fileName is string {
  if (
    typeof fileName !== "string" ||
    fileName === "" ||
    fileName === "." ||
    fileName === ".." ||
    fileName === STATE_FILE ||
    path.basename(fileName) !== fileName ||
    fileName.includes("\\") ||
    fileName.includes("/") ||
    fileName.includes("\0") ||
    !fileName.toLowerCase().endsWith(".jar")
  ) {
    throw new ValidationError(`Invalid mod file name: ${String(fileName)}`);
  }
}

const SHA1 = /^[0-9a-f]{40}$/;

/** Returns a clean copy of the mod, or throws. An invalid url is dropped (the mod comes from the host instead) */
export function validateClientMod(raw: unknown): ClientMod {
  const m = raw as Partial<ClientMod> | null;
  if (!m || typeof m !== "object") throw new ValidationError("Invalid mod entry");
  if (typeof m.sha1 !== "string" || !SHA1.test(m.sha1)) {
    throw new ValidationError("Invalid mod hash");
  }
  assertSyncFileName(m.fileName);
  if (
    typeof m.size !== "number" ||
    !Number.isFinite(m.size) ||
    m.size < 0 ||
    m.size > MAX_MOD_BYTES
  ) {
    throw new ValidationError(`Invalid mod size for ${m.fileName}`);
  }
  if (m.side !== "client" && m.side !== "both") {
    throw new ValidationError(`Invalid mod side for ${m.fileName}`);
  }
  return {
    sha1: m.sha1,
    fileName: m.fileName,
    size: m.size,
    name: typeof m.name === "string" && m.name ? m.name.slice(0, 200) : m.fileName,
    side: m.side,
    ...(isModrinthCdnUrl(m.url) && { url: m.url }),
  };
}

/** Validates the whole manifest; later entries repeating a hash or file name are dropped */
export function validateManifest(raw: unknown): ClientModManifest {
  const m = raw as Partial<ClientModManifest> | null;
  if (!m || typeof m !== "object" || !Array.isArray(m.mods) || m.mods.length > MAX_MODS) {
    throw new ValidationError("Invalid mod manifest");
  }
  const hashes = new Set<string>();
  const names = new Set<string>();
  const mods: ClientMod[] = [];
  for (const entry of m.mods) {
    const mod = validateClientMod(entry);
    if (hashes.has(mod.sha1) || names.has(mod.fileName.toLowerCase())) continue;
    hashes.add(mod.sha1);
    names.add(mod.fileName.toLowerCase());
    mods.push(mod);
  }
  const str = (v: unknown): string => (typeof v === "string" ? v.slice(0, 200) : "");
  return {
    serverName: str(m.serverName),
    engine: str(m.engine),
    minecraftVersion: str(m.minecraftVersion),
    ...(m.loaderVersion && { loaderVersion: str(m.loaderVersion) }),
    mods,
  };
}

function assertKey(key: unknown): asserts key is string {
  if (typeof key !== "string" || key === "" || key.length > MAX_KEY) {
    throw new ValidationError("Invalid sync folder key");
  }
}

// ---- pure planning ----

/** Mods whose file is already in the folder (by hash) are not downloaded again */
export function computePlan(
  mods: ClientMod[],
  folderHashes: Set<string>,
  previousManaged: Managed,
): Omit<SyncPlan, "folder"> {
  const wanted = new Set(mods.map((m) => m.sha1));
  return {
    download: mods.filter((m) => !folderHashes.has(m.sha1)),
    remove: managedToRemove(previousManaged, wanted),
    upToDate: mods.filter((m) => folderHashes.has(m.sha1)).length,
  };
}

/** Only files the app put there before (the managed map), and only if the host no longer lists them */
export function managedToRemove(previousManaged: Managed, wantedHashes: Set<string>): string[] {
  return Object.entries(previousManaged)
    .filter(([name, sha1]) => isValidName(name) && !wantedHashes.has(sha1))
    .map(([name]) => name);
}

function isValidName(name: string): boolean {
  try {
    assertSyncFileName(name);
    return true;
  } catch {
    return false;
  }
}

// ---- folder operations (take the folder directly so they run without Electron) ----

function readState(folder: string): SyncState {
  const state: SyncState = { managed: {}, server: "", updatedAt: 0 };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(folder, STATE_FILE), "utf-8"));
    for (const [name, sha1] of Object.entries(raw?.managed ?? {})) {
      if (isValidName(name) && typeof sha1 === "string" && SHA1.test(sha1)) {
        state.managed[name] = sha1;
      }
    }
    if (typeof raw?.server === "string") state.server = raw.server;
  } catch {
    // No state yet (or unreadable): nothing is managed
  }
  return state;
}

function writeState(folder: string, state: SyncState): void {
  state.updatedAt = Date.now();
  fs.writeFileSync(path.join(folder, STATE_FILE), JSON.stringify(state, null, 2), "utf-8");
}

async function folderJarHashes(folder: string): Promise<Map<string, string>> {
  const out = new Map<string, string>(); // fileName -> sha1
  const entries = await fs.promises.readdir(folder, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".jar"))
      .map(async (e) => {
        try {
          out.set(e.name, await sha1File(path.join(folder, e.name)));
        } catch {
          // Unreadable jar: can't count as present
        }
      }),
  );
  return out;
}

export async function planFolder(folder: string, manifest: ClientModManifest): Promise<SyncPlan> {
  const hashes = new Set((await folderJarHashes(folder)).values());
  return { folder, ...computePlan(manifest.mods, hashes, readState(folder).managed) };
}

/** Next free managed name: fileName, then name-pth.jar, name-pth-1.jar... A taken name is only reused if it is ours and untouched */
async function pickName(folder: string, fileName: string, managed: Managed): Promise<string> {
  const base = fileName.replace(/\.jar$/i, "");
  for (let i = -1; ; i++) {
    const candidate = i < 0 ? fileName : `${base}-pth${i === 0 ? "" : `-${i}`}.jar`;
    const target = path.join(folder, candidate);
    if (!fs.existsSync(target)) return candidate;
    const recorded = managed[candidate];
    if (recorded && (await sha1File(target).catch(() => "")) === recorded) return candidate;
  }
}

/** Fills a temp file in the folder, checks its hash, then renames it into place and records it */
async function installInto(
  folder: string,
  mod: ClientMod,
  fill: (tmp: string) => Promise<string>,
): Promise<void> {
  await fs.promises.mkdir(folder, { recursive: true });
  const tmp = path.join(folder, `.${crypto.randomBytes(6).toString("hex")}.pth-tmp`);
  try {
    if ((await fill(tmp)) !== mod.sha1) {
      throw new ValidationError(`Hash mismatch for ${mod.fileName}`);
    }
    const state = readState(folder);
    const name = await pickName(folder, mod.fileName, state.managed);
    await fs.promises.rename(tmp, path.join(folder, name));
    state.managed[name] = mod.sha1;
    writeState(folder, state);
  } catch (e) {
    await fs.promises.rm(tmp, { force: true });
    throw e;
  }
}

export function writeSyncedModTo(folder: string, mod: ClientMod, data: Uint8Array): Promise<void> {
  const clean = validateClientMod(mod);
  if (!(data instanceof Uint8Array) || data.length > MAX_MOD_BYTES) {
    throw new ValidationError("Invalid mod data");
  }
  return installInto(folder, clean, async (tmp) => {
    await fs.promises.writeFile(tmp, data);
    return crypto.createHash("sha1").update(data).digest("hex");
  });
}

export function downloadModrinthModTo(folder: string, mod: ClientMod): Promise<void> {
  const clean = validateClientMod(mod);
  if (!clean.url) throw new ValidationError(`No Modrinth download for ${clean.fileName}`);
  const url = clean.url;
  return installInto(folder, clean, (tmp) => download(url, tmp, MAX_REDIRECTS));
}

/** Streams the URL to dest and returns the SHA1 of what arrived. Redirects must stay on the CDN host */
async function download(url: string, dest: string, redirects: number): Promise<string> {
  const userAgent = await getUserAgent();
  const res = await new Promise<import("http").IncomingMessage>((resolve, reject) => {
    const req = https.get(
      url,
      { timeout: DOWNLOAD_TIMEOUT_MS, headers: { "User-Agent": userAgent } },
      resolve,
    );
    req.on("timeout", () => req.destroy(new Error("Download timed out")));
    req.on("error", reject);
  });
  const status = res.statusCode ?? 0;
  if (status >= 300 && status < 400 && res.headers.location) {
    res.resume();
    const next = new URL(res.headers.location, url).toString();
    if (redirects <= 0 || !isModrinthCdnUrl(next)) throw new Error("Unexpected download redirect");
    return download(next, dest, redirects - 1);
  }
  if (status !== 200) {
    res.resume();
    throw new Error(`HTTP ${status} downloading mod`);
  }
  const hash = crypto.createHash("sha1");
  let bytes = 0;
  await pipeline(
    res,
    new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        if (bytes > MAX_MOD_BYTES) return cb(new Error("Mod download too large"));
        hash.update(chunk);
        cb(null, chunk);
      },
    }),
    fs.createWriteStream(dest),
  );
  return hash.digest("hex");
}

/** Deletes managed files the manifest no longer lists (only if still byte-identical to what we wrote) */
export async function finishFolder(
  folder: string,
  manifest: ClientModManifest,
): Promise<{ removed: number }> {
  const state = readState(folder);
  const wanted = new Set(manifest.mods.map((m) => m.sha1));
  let removed = 0;
  for (const name of managedToRemove(state.managed, wanted)) {
    const target = path.join(folder, name);
    const onDisk = await sha1File(target).catch(() => null);
    if (onDisk === state.managed[name]) {
      await fs.promises.rm(target, { force: true });
      removed++;
    }
    delete state.managed[name];
  }
  state.server = manifest.serverName;
  writeState(folder, state);
  return { removed };
}

// ---- folder memory ----

export function loadFolders(file: string): Record<string, string> {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(raw).filter(
        (e): e is [string, string] => typeof e[1] === "string" && path.isAbsolute(e[1]),
      ),
    );
  } catch {
    return {};
  }
}

// ---- service ----

export class ModSync {
  private cache = new Map<string, { at: number; manifest: ClientModManifest; paths: Map<string, string> }>();

  constructor(private readonly repository: ModsRepository) {}

  // Host: what players need = client-mods/ plus everything in mods/ that isn't server-only
  async clientManifest(serverId: string): Promise<ClientModManifest> {
    const list = await this.repository.list(serverId);
    const mods: ClientMod[] = [];
    const paths = new Map<string, string>();
    for (const item of list.mods) {
      if (!item.sha1 || (item.folder !== "client-mods" && item.side === "server")) continue;
      if (paths.has(item.sha1)) continue;
      try {
        const mod = validateClientMod({
          sha1: item.sha1,
          fileName: item.fileName,
          size: item.sizeBytes,
          name: item.metadata?.name ?? item.modrinth?.title ?? item.fileName,
          side: item.side === "client" ? "client" : "both",
          url: item.downloadUrl,
        });
        mods.push(mod);
        paths.set(mod.sha1, this.repository.jarPath(serverId, item.folder, item.fileName));
      } catch {
        // Jar that can't be shared (odd name, too big): left out
      }
    }
    const manifest: ClientModManifest = {
      serverName: list.serverName,
      engine: list.engine,
      minecraftVersion: list.minecraftVersion,
      ...(list.loaderVersion && { loaderVersion: list.loaderVersion }),
      mods: list.engine === "paper" ? [] : mods,
    };
    this.cache.set(serverId, { at: Date.now(), manifest, paths });
    return manifest;
  }

  async readClientMod(serverId: string, sha1: string): Promise<Uint8Array> {
    if (typeof sha1 !== "string" || !SHA1.test(sha1)) throw new ValidationError("Invalid mod hash");
    let entry = this.cache.get(serverId);
    if (!entry || Date.now() - entry.at > MANIFEST_TTL_MS) {
      await this.clientManifest(serverId);
      entry = this.cache.get(serverId);
    }
    const file = entry?.manifest.mods.some((m) => m.sha1 === sha1) && entry.paths.get(sha1);
    if (!file) throw new ValidationError("Mod is not in this server's client mod list");
    const data = await fs.promises.readFile(file);
    if (crypto.createHash("sha1").update(data).digest("hex") !== sha1) {
      throw new ValidationError("Mod changed on disk");
    }
    return data;
  }

  async getSyncFolder(key: string): Promise<string | null> {
    assertKey(key);
    const folder = loadFolders(await this.foldersFile())[key];
    return folder && fs.existsSync(folder) ? folder : null;
  }

  async pickSyncFolder(key: string): Promise<string | null> {
    assertKey(key);
    const { BrowserWindow, dialog } = await import("electron");
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const options: Electron.OpenDialogOptions = { properties: ["openDirectory", "createDirectory"] };
    const { canceled, filePaths } = await (win
      ? dialog.showOpenDialog(win, options)
      : dialog.showOpenDialog(options));
    if (canceled || filePaths.length === 0) return null;
    const file = await this.foldersFile();
    fs.writeFileSync(file, JSON.stringify({ ...loadFolders(file), [key]: filePaths[0] }), "utf-8");
    return filePaths[0];
  }

  async planSync(key: string, manifest: ClientModManifest): Promise<SyncPlan> {
    return planFolder(await this.requireFolder(key), validateManifest(manifest));
  }

  async downloadModrinthMod(key: string, mod: ClientMod): Promise<void> {
    return downloadModrinthModTo(await this.requireFolder(key), mod);
  }

  async writeSyncedMod(key: string, mod: ClientMod, data: Uint8Array): Promise<void> {
    return writeSyncedModTo(await this.requireFolder(key), mod, data);
  }

  async finishSync(key: string, manifest: ClientModManifest): Promise<{ removed: number }> {
    return finishFolder(await this.requireFolder(key), validateManifest(manifest));
  }

  private async requireFolder(key: string): Promise<string> {
    const folder = await this.getSyncFolder(key);
    if (!folder) throw new ValidationError("No mods folder chosen for this server");
    return folder;
  }

  private async foldersFile(): Promise<string> {
    const { app } = await import("electron");
    return path.join(app.getPath("userData"), "mod-sync-folders.json");
  }
}
