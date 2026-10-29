import * as crypto from "crypto";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import { getUserAgent } from "@main/contexts/server-lifecycle/infrastructure/repositories/EngineCatalog";
import type { ModLoader, ModMetadata } from "@main/contexts/mods/domain/parseModMetadata";

export type ModrinthSupport = "required" | "optional" | "unsupported" | "unknown";

export interface ModrinthInfo {
  projectId: string;
  slug: string;
  title: string;
  versionNumber: string;
  loaders: string[];
  clientSide: ModrinthSupport;
  serverSide: ModrinthSupport;
  /** Modrinth CDN URL of this exact file (absent in cache entries from before mod sync) */
  downloadUrl?: string;
}

const API = "https://api.modrinth.com/v2";
const TIMEOUT_MS = 8000;
const HASH_CHUNK = 500;
const PROJECT_CHUNK = 100;
const MISS_TTL_MS = 24 * 60 * 60 * 1000;

// Bump when ModrinthInfo gains fields: older entries are refetched once
const CACHE_VERSION = 2;
type CacheEntry = { v?: number; at: number; info: ModrinthInfo | null };
let memory: Record<string, CacheEntry> | null = null;
let memoryFile = "";

/** Trust boundary: only files served straight from Modrinth's CDN may be downloaded */
export function isModrinthCdnUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "cdn.modrinth.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}

/** Which side(s) need the mod, per Modrinth's own client/server flags */
export function sideFromModrinth(
  info: Pick<ModrinthInfo, "clientSide" | "serverSide">,
): "client" | "server" | "both" {
  if (info.serverSide === "unsupported") return "client";
  if (info.clientSide === "unsupported") return "server";
  return "both";
}

const MODRINTH_LOADERS: Record<string, ModLoader> = {
  fabric: "fabric",
  quilt: "quilt",
  forge: "forge",
  neoforge: "neoforge",
  bukkit: "plugin",
  spigot: "plugin",
  paper: "plugin",
  purpur: "plugin",
};

/** Stand-in metadata for jars that carry none (libraries like Kotlin for Forge) but Modrinth knows */
export function metadataFromModrinth(info: ModrinthInfo): ModMetadata {
  const loaders = [
    ...new Set(info.loaders.map((l) => MODRINTH_LOADERS[l]).filter((l): l is ModLoader => !!l)),
  ];
  return {
    id: info.slug,
    name: info.title,
    version: info.versionNumber,
    loaders,
    side: sideFromModrinth(info),
  };
}

/**
 * Looks the jars up on Modrinth by SHA1. Never throws: offline or on any error it returns
 * whatever the cache already knows. `hashesOut`, when given, receives each readable file's SHA1.
 */
export async function lookupModrinth(
  filePaths: string[],
  cacheFile?: string,
  hashesOut?: Map<string, string>,
): Promise<Map<string, ModrinthInfo>> {
  const result = new Map<string, ModrinthInfo>();
  try {
    const file = cacheFile ?? (await defaultCacheFile());
    const cache = loadCache(file);
    const hashes = new Map<string, string>(); // filePath -> sha1
    await Promise.all(
      filePaths.map(async (p) => {
        try {
          hashes.set(p, await sha1File(p));
        } catch {
          // Unreadable file: no lookup for it
        }
      }),
    );

    hashesOut && hashes.forEach((h, p) => hashesOut.set(p, h));

    const fresh = (e: CacheEntry | undefined): boolean =>
      !!e && e.v === CACHE_VERSION && (e.info !== null || Date.now() - e.at < MISS_TTL_MS);
    const missing = [...new Set(hashes.values())].filter((h) => !fresh(cache[h]));
    try {
      await fetchInto(cache, missing);
      fs.writeFileSync(file, JSON.stringify(cache), "utf-8");
    } catch (e) {
      console.warn("[mods] Modrinth lookup failed:", e instanceof Error ? e.message : e);
    }

    for (const [p, h] of hashes) {
      const info = cache[h]?.info;
      if (info) result.set(p, info);
    }
  } catch (e) {
    console.warn("[mods] Modrinth cache unavailable:", e instanceof Error ? e.message : e);
  }
  return result;
}

async function fetchInto(cache: Record<string, CacheEntry>, hashes: string[]): Promise<void> {
  type Version = {
    project_id: string;
    version_number: string;
    loaders?: string[];
    files?: { hashes?: { sha1?: string }; url?: string }[];
  };
  type Project = { id: string; slug: string; title: string; client_side?: string; server_side?: string };
  const support = (v: unknown): ModrinthSupport =>
    v === "required" || v === "optional" || v === "unsupported" ? v : "unknown";

  for (let i = 0; i < hashes.length; i += HASH_CHUNK) {
    const chunk = hashes.slice(i, i + HASH_CHUNK);
    const versions = (await request("POST", `${API}/version_files`, {
      hashes: chunk,
      algorithm: "sha1",
    })) as Record<string, Version>;

    const projectIds = [...new Set(Object.values(versions).map((v) => v.project_id))];
    const projects = new Map<string, Project>();
    for (let j = 0; j < projectIds.length; j += PROJECT_CHUNK) {
      const ids = encodeURIComponent(JSON.stringify(projectIds.slice(j, j + PROJECT_CHUNK)));
      for (const p of (await request("GET", `${API}/projects?ids=${ids}`)) as Project[]) {
        projects.set(p.id, p);
      }
    }

    const now = Date.now();
    for (const hash of chunk) {
      const version = versions[hash];
      const project = version && projects.get(version.project_id);
      const url = version?.files?.find((f) => f.hashes?.sha1 === hash)?.url;
      cache[hash] = {
        v: CACHE_VERSION,
        at: now,
        info: project
          ? {
              projectId: project.id,
              slug: project.slug,
              title: project.title,
              versionNumber: version.version_number,
              loaders: version.loaders ?? [],
              clientSide: support(project.client_side),
              serverSide: support(project.server_side),
              ...(isModrinthCdnUrl(url) && { downloadUrl: url }),
            }
          : null,
      };
    }
  }
}

function request(method: "GET" | "POST", url: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    getUserAgent().then((userAgent) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = https.request(
        url,
        {
          method,
          timeout: TIMEOUT_MS,
          headers: {
            "User-Agent": userAgent,
            ...(payload && {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            }),
          },
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (data += chunk));
          res.on("error", reject);
          res.on("end", () => {
            if ((res.statusCode ?? 0) >= 400) {
              reject(new Error(`HTTP ${res.statusCode} from ${url.split("?")[0]}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Invalid JSON from Modrinth"));
            }
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("Modrinth request timed out")));
      req.on("error", reject);
      req.end(payload);
    }, reject);
  });
}

export function sha1File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function defaultCacheFile(): Promise<string> {
  const { app } = await import("electron");
  return path.join(app.getPath("userData"), "modrinth-cache.json");
}

function loadCache(file: string): Record<string, CacheEntry> {
  if (memory && memoryFile === file) return memory;
  try {
    memory = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, CacheEntry>;
  } catch {
    memory = {};
  }
  memoryFile = file;
  return memory;
}
