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
  /** Other mod ids this jar declares, besides minecraft/loaders */
  dependencies: {
    id: string;
    range?: string;
    kind: "required" | "breaks" | "conflicts";
    /** Which metadata file declared it: a Fabric+Forge jar only follows the running loader's */
    loader?: ModLoader;
  }[];
  /** Extra ids this jar satisfies: fabric/quilt `provides`, other mods in a multi-mod toml, nested jar-in-jar mods */
  provides: string[];
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
  "META-INF/jarjar/metadata.json",
];

type Dependency = ModMetadata["dependencies"][number];

// Platform ids every mod may name; they are never another mod
const PLATFORM_IDS = new Set([
  "minecraft",
  "java",
  "fabricloader",
  "fabric-loader",
  "mixinextras", // built into Fabric Loader 0.15+
  "quilt_loader",
  "forge",
  "neoforge",
  "javafml",
  "lowcodefml",
  "mcp",
]);
const realDeps = (deps: Dependency[]): Dependency[] => deps.filter((d) => !PLATFORM_IDS.has(d.id));

/** Paths of the jars bundled inside this one (fabric/quilt jars, forge jarjar) */
export function nestedJarPaths(entries: Map<string, Buffer>): string[] {
  const json = (name: string): unknown => parseJson(entries.get(name)?.toString("utf8"));
  const file = (v: unknown): string | undefined => str(v) ?? str(asObject(v)?.file);
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  return [
    ...list(asObject(json("fabric.mod.json"))?.jars).map(file),
    ...list(asObject(asObject(json("quilt.mod.json"))?.quilt_loader)?.jars).map(file),
    ...list(asObject(json("META-INF/jarjar/metadata.json"))?.jars).map((j) => str(asObject(j)?.path)),
  ].filter((p): p is string => !!p);
}

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
  return {
    ...primary,
    loaders: [...new Set(found.map((p) => p.loader))],
    dependencies: found.flatMap((p) => p.dependencies.map((d) => ({ ...d, loader: p.loader }))),
    provides: [...new Set(found.flatMap((p) => p.provides))],
  };
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
  const dependencies: Dependency[] = [];
  for (const [key, kind] of [
    ["depends", "required"],
    ["breaks", "breaks"],
    ["conflicts", "conflicts"],
  ] as const) {
    for (const [depId, range] of Object.entries(asObject(json[key]) ?? {})) {
      dependencies.push({ id: depId, range: versionRange(range), kind });
    }
  }
  return {
    loader: "fabric",
    id,
    name: str(json.name) ?? id,
    version: fixVersion(str(json.version)),
    minecraft: versionRange(asObject(json.depends)?.minecraft),
    side: environment === "client" ? "client" : environment === "server" ? "server" : "both",
    description: str(json.description),
    dependencies: realDeps(dependencies),
    provides: strings(json.provides),
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseQuilt(raw: string | undefined, fixVersion: (v?: string) => string): Parsed | null {
  const json = asObject(parseJson(raw));
  const loader = asObject(json?.quilt_loader);
  const id = str(loader?.id);
  if (!loader || !id) return null;
  const metadata = asObject(loader.metadata);
  const depends = Array.isArray(loader.depends) ? loader.depends : [];
  const mc = depends.find((d) => d === "minecraft" || asObject(d)?.id === "minecraft");
  const environment = asObject(json?.minecraft)?.environment;
  const quiltDeps = (list: unknown, kind: Dependency["kind"]): Dependency[] =>
    (Array.isArray(list) ? list : []).flatMap((d): Dependency[] => {
      const o = asObject(d);
      if (typeof d === "string") return [{ id: d, kind }];
      const depId = str(o?.id);
      return depId && o?.optional !== true ? [{ id: depId, range: versionRange(o?.versions), kind }] : [];
    });
  return {
    loader: "quilt",
    id,
    name: str(metadata?.name) ?? id,
    version: fixVersion(str(loader.version)),
    minecraft: versionRange(asObject(mc)?.versions),
    side:
      environment === "client" ? "client" : environment === "dedicated_server" ? "server" : "both",
    description: str(metadata?.description),
    dependencies: realDeps([...quiltDeps(depends, "required"), ...quiltDeps(loader.breaks, "breaks")]),
    provides: (Array.isArray(loader.provides) ? loader.provides : [])
      .map((p) => str(p) ?? str(asObject(p)?.id))
      .filter((p): p is string => !!p),
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
  const dependencies = deps.flatMap((d): Dependency[] => {
    const depId = str(d.values.modId);
    if (!depId) return [];
    const { mandatory, versionRange: range } = d.values;
    // A dependency only the client needs never matters to the server
    if (d.values.side?.toUpperCase() === "CLIENT") return [];
    const type = d.values.type?.toLowerCase();
    const kind =
      type === "required" || mandatory === "true"
        ? "required"
        : type === "incompatible"
          ? "breaks"
          : type === "discouraged"
            ? "conflicts"
            : null;
    return kind ? [{ id: depId, range: str(range), kind }] : [];
  });
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
    dependencies: realDeps(dependencies),
    // Multi-mod jars: every other [[mods]] entry is satisfied by this jar too
    provides: tables
      .filter((t) => t.name === "mods" && t.values.modId && t.values.modId !== id)
      .map((t) => t.values.modId),
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
    dependencies: [],
    provides: [],
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
  // `depend:` as `[A, B]` or a block list of `- A` lines
  // ponytail: paper-plugin.yml's nested `dependencies:` section isn't read, only the classic `depend:`
  const block = raw.match(/^depend:[ \t]*(.*)\r?\n((?:[ \t]*-[^\n]*\n?)*)/m);
  const names = block
    ? (block[1].startsWith("[")
        ? block[1].replace(/[[\]]/g, "").split(",")
        : block[2].split(/\r?\n/).map((l) => l.replace(/^\s*-\s*/, ""))
      )
        .map((n) => n.replace(/\s+#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2").toLowerCase())
        .filter(Boolean)
    : [];
  return {
    loader: "plugin",
    id: name.toLowerCase(),
    name,
    version: read("version") ?? "unknown",
    minecraft: read("api-version"),
    side: "server",
    description: read("description"),
    dependencies: names.map((id) => ({ id, kind: "required" as const })),
    provides: [],
  };
}
