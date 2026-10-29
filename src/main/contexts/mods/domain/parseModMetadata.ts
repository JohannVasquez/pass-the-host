export type ModLoader = "fabric" | "quilt" | "forge" | "neoforge" | "plugin";

export interface ModMetadata {
  id: string;
  name: string;
  version: string;
  loaders: ModLoader[];
  /** Raw requirement text shown to the user, e.g. ">=1.21", "[1.20.1,1.21)", "1.12.2" */
  minecraft?: string;
  side: "both" | "client" | "server";
  description?: string;
}

/** Entry names parseModMetadata reads, so callers can extract them in one pass */
export const MOD_METADATA_ENTRIES = [
  "fabric.mod.json",
  "quilt.mod.json",
  "META-INF/neoforge.mods.toml",
  "META-INF/mods.toml",
  "mcmod.info",
  "plugin.yml",
  "paper-plugin.yml",
  "META-INF/MANIFEST.MF",
];

type Parsed = Omit<ModMetadata, "loaders"> & { loader: ModLoader };
type Json = Record<string, unknown>;

export function parseModMetadata(entries: Map<string, Buffer>): ModMetadata | null {
  const text = (name: string): string | undefined =>
    entries
      .get(name)
      ?.toString("utf8")
      .replace(/^\uFEFF/, "");
  const manifestVersion = readManifestVersion(text("META-INF/MANIFEST.MF"));
  const fixVersion = (version: string | undefined): string =>
    version && !version.includes("${") ? version : (manifestVersion ?? "unknown");

  // Priority order: fabric, quilt, neoforge.mods.toml, mods.toml, mcmod.info, plugin
  const parsed: Array<Parsed | null> = [
    parseFabric(text("fabric.mod.json"), fixVersion),
    parseQuilt(text("quilt.mod.json"), fixVersion),
    parseToml(text("META-INF/neoforge.mods.toml"), true, fixVersion),
    parseToml(text("META-INF/mods.toml"), false, fixVersion),
    parseMcmodInfo(text("mcmod.info"), fixVersion),
    parsePluginYml(text("paper-plugin.yml")) ?? parsePluginYml(text("plugin.yml")),
  ];
  const found = parsed.filter((p): p is Parsed => p !== null);
  if (found.length === 0) return null;

  const { loader: _loader, ...primary } = found[0];
  return { ...primary, loaders: [...new Set(found.map((p) => p.loader))] };
}

function readManifestVersion(manifest: string | undefined): string | undefined {
  return manifest?.match(/^Implementation-Version:\s*(.+?)\s*$/m)?.[1];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // Some files hold raw newlines/tabs inside strings
    try {
      return JSON.parse(
        raw.replace(/"(?:[^"\\]|\\.)*"/gs, (s) =>
          // eslint-disable-next-line no-control-regex
          s.replace(/[\x00-\x1f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`),
        ),
      );
    } catch {
      return undefined;
    }
  }
}

function asObject(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}

function versionRange(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.filter((v): v is string => typeof v === "string");
    return parts.length > 0 ? parts.join(" || ") : undefined;
  }
  return undefined;
}

function parseFabric(raw: string | undefined, fixVersion: (v?: string) => string): Parsed | null {
  const json = asObject(parseJson(raw));
  const id = str(json?.id);
  if (!json || !id) return null;
  const environment = json.environment;
  return {
    loader: "fabric",
    id,
    name: str(json.name) ?? id,
    version: fixVersion(str(json.version)),
    minecraft: versionRange(asObject(json.depends)?.minecraft),
    side: environment === "client" ? "client" : environment === "server" ? "server" : "both",
    description: str(json.description),
  };
}

function parseQuilt(raw: string | undefined, fixVersion: (v?: string) => string): Parsed | null {
  const json = asObject(parseJson(raw));
  const loader = asObject(json?.quilt_loader);
  const id = str(loader?.id);
  if (!loader || !id) return null;
  const metadata = asObject(loader.metadata);
  const depends = Array.isArray(loader.depends) ? loader.depends : [];
  const mc = depends.find((d) => d === "minecraft" || asObject(d)?.id === "minecraft");
  const environment = asObject(json?.minecraft)?.environment;
  return {
    loader: "quilt",
    id,
    name: str(metadata?.name) ?? id,
    version: fixVersion(str(loader.version)),
    minecraft: versionRange(asObject(mc)?.versions),
    side:
      environment === "client" ? "client" : environment === "dedicated_server" ? "server" : "both",
    description: str(metadata?.description),
  };
}

interface TomlTable {
  name: string;
  values: Record<string, string>;
}

/** Minimal TOML reader: tables and string/bare values, enough for mods.toml */
function readToml(raw: string): TomlTable[] {
  let current: TomlTable = { name: "", values: {} };
  const tables: TomlTable[] = [current];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = line.match(/^\[{1,2}\s*([^\]]+?)\s*\]{1,2}\s*(#.*)?$/);
    if (header) {
      current = { name: header[1], values: {} };
      tables.push(current);
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_.\-"']+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].replace(/["']/g, "");
    let rest = kv[2];
    // Inline form: mods = [ { modId = '...', ... } ] -> one table per { }
    if (rest.startsWith("[") || rest.startsWith("{")) {
      const depth = (s: string): number =>
        (s.match(/[[{]/g)?.length ?? 0) - (s.match(/[\]}]/g)?.length ?? 0);
      while (depth(rest) > 0 && i + 1 < lines.length) rest += `\n${lines[++i]}`;
      for (const group of rest.match(/\{[^{}]*\}/g) ?? []) {
        const values: Record<string, string> = {};
        for (const [, k, v] of group.matchAll(/(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^,}\s]+)/g)) {
          values[k] = v.replace(/^(["'])([\s\S]*)\1$/, "$2");
        }
        // [dependencies] + modid = [{...}] is the same as [[dependencies.modid]]
        tables.push({ name: current.name === "dependencies" ? `dependencies.${key}` : key, values });
      }
      continue;
    }
    const triple = rest.match(/^("""|''')/);
    let value: string;
    if (triple) {
      const quote = triple[1];
      rest = rest.slice(3);
      while (!rest.includes(quote) && i + 1 < lines.length) rest += `\n${lines[++i]}`;
      value = rest.slice(0, Math.max(rest.indexOf(quote), 0));
    } else if (rest.startsWith('"') || rest.startsWith("'")) {
      const end = rest.indexOf(rest[0], 1);
      value = rest.slice(1, end === -1 ? undefined : end);
    } else {
      value = rest.replace(/\s*#.*$/, "").trim();
    }
    current.values[key] = value;
  }
  return tables;
}

function parseToml(
  raw: string | undefined,
  neoforgeFile: boolean,
  fixVersion: (v?: string) => string,
): Parsed | null {
  if (raw === undefined) return null;
  const tables = readToml(raw);
  const mod = tables.find((t) => t.name === "mods");
  const id = str(mod?.values.modId);
  if (!mod || !id) return null;
  const deps = tables.filter((t) => t.name.startsWith("dependencies."));
  const hasDep = (modId: string): boolean => deps.some((d) => d.values.modId === modId);
  const minecraft = deps.find((d) => d.values.modId === "minecraft")?.values.versionRange;
  // Heuristic: the toml has no real side marker, only these hints (Modrinth is the better source)
  const displayTest = mod.values.displayTest;
  const side =
    displayTest === "IGNORE_SERVER_VERSION"
      ? "server"
      : displayTest === "IGNORE_ALL_VERSION" || tables[0].values.clientSideOnly === "true"
        ? "client"
        : "both";
  return {
    loader: neoforgeFile || hasDep("neoforge") ? "neoforge" : "forge",
    id,
    name: str(mod.values.displayName) ?? id,
    version: fixVersion(str(mod.values.version)),
    minecraft: str(minecraft),
    side,
    description: str(mod.values.description)?.trim(),
  };
}

function parseMcmodInfo(
  raw: string | undefined,
  fixVersion: (v?: string) => string,
): Parsed | null {
  const json = parseJson(raw);
  const list = Array.isArray(json) ? json : asObject(json)?.modList;
  const first = Array.isArray(list) ? asObject(list[0]) : undefined;
  const id = str(first?.modid);
  if (!first || !id) return null;
  return {
    loader: "forge",
    id,
    name: str(first.name) ?? id,
    version: fixVersion(str(first.version)),
    minecraft: str(first.mcversion),
    side: "both",
    description: str(first.description),
  };
}

function parsePluginYml(raw: string | undefined): Parsed | null {
  if (raw === undefined) return null;
  const read = (key: string): string | undefined => {
    const match = raw.match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, "m"));
    return str(match?.[1].replace(/^(["'])(.*)\1$/, "$2"));
  };
  const name = read("name");
  if (!name) return null;
  return {
    loader: "plugin",
    id: name.toLowerCase(),
    name,
    version: read("version") ?? "unknown",
    minecraft: read("api-version"),
    side: "server",
    description: read("description"),
  };
}
