import * as https from "https";
import { NetworkError } from "@shared/domain/errors";

import type { EngineType } from "@main/contexts/server-lifecycle/domain/entities";

export interface EngineVersion {
  id: string;
  label: string;
  beta?: boolean;
}

export interface EngineVersionList {
  versions: EngineVersion[];
  recommended: string | null;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_REDIRECTS = 5;

const MOJANG_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const PAPER_API = "https://fill.papermc.io/v3/projects/paper";
const FABRIC_META = "https://meta.fabricmc.net/v2/versions";
const QUILT_META = "https://meta.quiltmc.org/v3/versions";
const FORGE_METADATA = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
const FORGE_PROMOTIONS = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const NEOFORGE_METADATA =
  "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
// NeoForge for 1.20.1 is still published under the old "forge" artifact
const NEOFORGE_LEGACY_METADATA =
  "https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml";

const cache = new Map<string, { at: number; data: string }>();
let userAgent: string | null = null;

export async function getUserAgent(): Promise<string> {
  if (!userAgent) {
    let version = "dev";
    try {
      const { app } = await import("electron");
      version = app.getVersion();
    } catch {
      // Outside Electron (scripts/tests)
    }
    userAgent = `PassTheHost/${version} (https://github.com/JohannVasquez/pass-the-host)`;
  }
  return userAgent;
}

/** GET a URL as text, following redirects and always sending our User-Agent (Paper's API requires one). */
export async function httpGetText(url: string, redirects = 0): Promise<string> {
  const headers = { "User-Agent": await getUserAgent() };
  return new Promise<string>((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new NetworkError(`Too many redirects fetching ${url}`));
            return;
          }
          const next = new URL(response.headers.location, url).toString();
          httpGetText(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (status >= 400) {
          response.resume();
          reject(new NetworkError(`HTTP ${status} fetching ${url}`));
          return;
        }
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => resolve(data));
        response.on("error", (e) => reject(new NetworkError(`${e.message} (${url})`)));
      })
      .on("error", (e) => reject(new NetworkError(`${e.message} (${url})`)));
  });
}

async function cachedText(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await httpGetText(url);
  cache.set(url, { at: Date.now(), data });
  return data;
}

async function cachedJson<T>(url: string): Promise<T> {
  const text = await cachedText(url);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NetworkError(`Invalid response from ${url}`);
  }
}

export function parseMavenVersions(xml: string): string[] {
  return Array.from(xml.matchAll(/<version>([^<]+)<\/version>/g)).map((m) => m[1]);
}

/** Compares dotted/dashed versions segment by segment, numerically when both segments are numbers. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+_]/);
  const pb = b.split(/[.\-+_]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "";
    const y = pb[i] ?? "";
    const nx = /^\d+$/.test(x) ? parseInt(x) : NaN;
    const ny = /^\d+$/.test(y) ? parseInt(y) : NaN;
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      // A numeric segment beats a missing one, but a missing one beats a tag ("0.2.0" > "0.2.0-beta.1")
      if (x === "") return Number.isNaN(ny) ? 1 : -1;
      if (y === "") return Number.isNaN(nx) ? -1 : 1;
      if (!Number.isNaN(nx)) return 1;
      if (!Number.isNaN(ny)) return -1;
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

const newestFirst = (a: string, b: string): number => compareVersions(b, a);

const isRelease = (v: string): boolean => /^\d+(\.\d+)+$/.test(v);

/** NeoForge "21.1.77" -> "1.21.1", "21.0.5" -> "1.21", "26.1.0.3" -> "26.1" */
export function neoForgeMinecraftVersion(neoVersion: string): string | null {
  const m = neoVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  const [major, second, third] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (major >= 26) return third === 0 ? `${major}.${second}` : `${major}.${second}.${third}`;
  if (major < 20) return null;
  return second === 0 ? `1.${major}` : `1.${major}.${second}`;
}

const isBetaTag = (v: string): boolean => /alpha|beta/i.test(v);

export async function listGameVersions(engine: EngineType): Promise<string[]> {
  switch (engine) {
    case "vanilla": {
      const manifest = await cachedJson<{ versions: Array<{ id: string; type: string }> }>(
        MOJANG_MANIFEST,
      );
      // The manifest is already newest first
      return manifest.versions.filter((v) => v.type === "release").map((v) => v.id);
    }
    case "paper": {
      const project = await cachedJson<{ versions: Record<string, string[]> }>(PAPER_API);
      return Object.values(project.versions).flat().filter(isRelease).sort(newestFirst);
    }
    case "fabric":
    case "quilt": {
      const url = `${engine === "fabric" ? FABRIC_META : QUILT_META}/game`;
      const games = await cachedJson<Array<{ version: string; stable: boolean }>>(url);
      return games.filter((g) => g.stable).map((g) => g.version);
    }
    case "forge": {
      const mcVersions = parseMavenVersions(await cachedText(FORGE_METADATA)).map((v) =>
        v.slice(0, v.indexOf("-")),
      );
      // Forge installers before 1.7.10 don't support --installServer reliably
      return [...new Set(mcVersions)]
        .filter((v) => isRelease(v) && compareVersions(v, "1.7.10") >= 0)
        .sort(newestFirst);
    }
    case "neoforge": {
      const mcVersions = parseMavenVersions(await cachedText(NEOFORGE_METADATA))
        .map(neoForgeMinecraftVersion)
        .filter((v): v is string => v !== null);
      return [...new Set([...mcVersions, "1.20.1"])].sort(newestFirst);
    }
  }
}

function pickRecommended(
  versions: EngineVersion[],
  preferred?: string | null,
): string | null {
  if (preferred && versions.some((v) => v.id === preferred)) return preferred;
  return (versions.find((v) => !v.beta) ?? versions[0])?.id ?? null;
}

interface PaperBuild {
  id: number;
  channel: string;
  downloads: Record<string, { name: string; url: string }>;
}

/** Paper builds for a Minecraft version, newest first (also used to get the jar URL). */
export async function getPaperBuilds(mcVersion: string): Promise<PaperBuild[]> {
  const builds = await cachedJson<PaperBuild[]>(`${PAPER_API}/versions/${mcVersion}/builds`);
  return [...builds].sort((a, b) => b.id - a.id);
}

export async function listEngineVersions(
  engine: EngineType,
  mcVersion: string,
): Promise<EngineVersionList> {
  const result = (versions: EngineVersion[], preferred?: string | null): EngineVersionList => ({
    versions,
    recommended: pickRecommended(versions, preferred),
  });

  switch (engine) {
    case "vanilla":
      return { versions: [], recommended: null };
    case "paper": {
      const builds = await getPaperBuilds(mcVersion);
      return result(
        builds.map((b) => ({
          id: String(b.id),
          label: `build ${b.id}`,
          beta: b.channel !== "STABLE",
        })),
      );
    }
    case "fabric": {
      const loaders = await cachedJson<Array<{ loader: { version: string; stable: boolean } }>>(
        `${FABRIC_META}/loader/${mcVersion}`,
      );
      return result(
        loaders.map(({ loader }) => ({
          id: loader.version,
          label: loader.version,
          beta: !loader.stable,
        })),
      );
    }
    case "quilt": {
      const loaders = await cachedJson<Array<{ loader: { version: string } }>>(
        `${QUILT_META}/loader/${mcVersion}`,
      );
      // Quilt's API order isn't by version
      return result(
        loaders
          .map(({ loader }) => loader.version)
          .sort(newestFirst)
          .map((id) => ({ id, label: id, beta: id.includes("-") })),
      );
    }
    case "forge": {
      const prefix = `${mcVersion}-`;
      const ids = parseMavenVersions(await cachedText(FORGE_METADATA))
        .filter((v) => v.startsWith(prefix))
        .sort(newestFirst);
      const versions = ids.map((id) => ({ id, label: id.slice(prefix.length) }));
      const promos = await cachedJson<{ promos: Record<string, string> }>(FORGE_PROMOTIONS)
        .then((p) => p.promos)
        .catch(() => ({}) as Record<string, string>);
      const promo = promos[`${mcVersion}-recommended`] ?? promos[`${mcVersion}-latest`];
      // Old versions append the MC version again (e.g. 10.13.4.1614-1.7.10), so match by prefix
      const preferred = promo ? ids.find((id) => id.startsWith(`${prefix}${promo}`)) : null;
      return result(versions, preferred);
    }
    case "neoforge": {
      const legacy = mcVersion === "1.20.1";
      const ids = parseMavenVersions(
        await cachedText(legacy ? NEOFORGE_LEGACY_METADATA : NEOFORGE_METADATA),
      )
        .filter((v) =>
          legacy ? v.startsWith("1.20.1-") : neoForgeMinecraftVersion(v) === mcVersion,
        )
        .sort(newestFirst);
      return result(
        ids.map((id) => ({
          id,
          label: legacy ? id.slice("1.20.1-".length) : id,
          beta: isBetaTag(id),
        })),
      );
    }
  }
}

/** Latest stable Fabric installer version. */
export async function getFabricInstallerVersion(): Promise<string> {
  const installers = await cachedJson<Array<{ version: string; stable: boolean }>>(
    `${FABRIC_META}/installer`,
  );
  const installer = installers.find((i) => i.stable) ?? installers[0];
  if (!installer) throw new NetworkError("No Fabric installer version found");
  return installer.version;
}

/** Latest release of the Quilt installer. */
export async function getQuiltInstallerVersion(): Promise<string> {
  const xml = await cachedText(
    "https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/maven-metadata.xml",
  );
  const release = xml.match(/<release>([^<]+)<\/release>/)?.[1];
  if (!release) throw new NetworkError("No Quilt installer version found");
  return release;
}
