import type { ModLoader, ModMetadata } from "./parseModMetadata";

export type ModCompat =
  | { status: "ok" }
  | { status: "warning"; reason: "client_only" | "unknown_minecraft" }
  | { status: "error"; reason: "wrong_loader"; loaders: ModLoader[]; engine: string }
  | { status: "error"; reason: "wrong_minecraft"; required: string; actual: string }
  | { status: "error"; reason: "not_a_mod" };

function acceptedLoaders(engine: string, mcVersion: string): ModLoader[] {
  switch (engine) {
    case "fabric":
      return ["fabric"];
    case "quilt":
      return ["quilt", "fabric"];
    case "forge":
      return ["forge"];
    case "neoforge":
      return mcVersion === "1.20.1" ? ["neoforge", "forge"] : ["neoforge"];
    case "paper":
      return ["plugin"];
    default:
      return [];
  }
}

export function checkModCompatibility(
  meta: ModMetadata | null,
  engine: string,
  mcVersion: string,
): ModCompat {
  if (!meta) return { status: "error", reason: "not_a_mod" };
  const accepted = acceptedLoaders(engine, mcVersion);
  const loader = meta.loaders.find((l) => accepted.includes(l));
  if (!loader) {
    return { status: "error", reason: "wrong_loader", loaders: meta.loaders, engine };
  }
  if (meta.side === "client") return { status: "warning", reason: "client_only" };
  if (!meta.minecraft) return { status: "ok" };

  const bare: BareStyle =
    loader === "plugin"
      ? "minimum"
      : loader === "forge" && engine === "forge" && versionParts(mcVersion)[1] <= 12
        ? "majorMinor" // mcmod.info era (1.12 and older)
        : loader === "forge" || loader === "neoforge"
          ? "minimum"
          : "exact";
  const matches = matchesMinecraft(meta.minecraft, mcVersion, bare);
  if (matches === null) return { status: "warning", reason: "unknown_minecraft" };
  if (!matches) {
    return {
      status: "error",
      reason: "wrong_minecraft",
      required: meta.minecraft,
      actual: mcVersion,
    };
  }
  return { status: "ok" };
}

/** How a bare version like "1.20.1" is read: Maven/plugins "at least", fabric "exactly", mcmod.info major.minor */
export type BareStyle = "minimum" | "exact" | "majorMinor";

/** Numeric segments, ignoring any pre-release suffix; empty when unparseable */
function versionParts(version: string): number[] {
  const core = version.trim().split("-")[0];
  if (!/^\d+(\.\d+)*$/.test(core)) return [];
  return core.split(".").map(Number);
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** true/false, or null when the requirement can't be understood */
export function matchesMinecraft(
  requirement: string,
  mcVersion: string,
  bare: BareStyle = "minimum",
): boolean | null {
  const mc = versionParts(mcVersion);
  const text = requirement.trim();
  if (mc.length === 0 || text === "") return null;
  if (/^[[(]/.test(text)) return matchesMaven(text, mc);

  // Fabric/Quilt predicates: alternatives are OR, space-separated terms are AND
  let unknown = false;
  for (const alternative of text.split("||")) {
    const tokens = alternative
      .trim()
      .replace(/([<>=~^]+)\s+/g, "$1")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) {
      unknown = true;
      continue;
    }
    const results = tokens.map((t) => matchesTerm(t, mc, bare));
    if (results.every((r) => r === true)) return true;
    if (results.includes(null)) unknown = true;
  }
  return unknown ? null : false;
}

function matchesTerm(term: string, mc: number[], bare: BareStyle): boolean | null {
  if (term === "*") return true;
  const match = term.match(/^(>=|<=|>|<|=|~|\^)?(.+)$/);
  if (!match) return null;
  const [, op, rawVersion] = match;

  const wildcard = rawVersion.match(/^(\d+(?:\.\d+)*)\.(?:x|X|\*)$/);
  if (wildcard && !op) {
    const prefix = wildcard[1].split(".").map(Number);
    return prefix.every((n, i) => mc[i] === n);
  }

  const v = versionParts(rawVersion);
  if (v.length === 0) return null;
  const c = compare(mc, v);
  switch (op) {
    case ">=":
      return c >= 0;
    case ">":
      return c > 0;
    case "<=":
      return c <= 0;
    case "<":
      return c < 0;
    case "=":
      return c === 0;
    case "~":
      return c >= 0 && compare(mc, [v[0], (v[1] ?? 0) + 1]) < 0;
    case "^":
      return c >= 0 && compare(mc, [v[0] + 1]) < 0;
    default:
      if (bare === "minimum") return c >= 0;
      if (bare === "majorMinor") return mc[0] === v[0] && mc[1] === (v[1] ?? 0);
      return c === 0;
  }
}

function matchesMaven(text: string, mc: number[]): boolean | null {
  const ranges = text.match(/[[(][^\])]*[\])]/g);
  if (!ranges) return null;
  let unknown = false;
  for (const range of ranges) {
    const [low, high] = range
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim());
    const hasHigh = range.includes(",");
    const lowParts = low ? versionParts(low) : null;
    const highParts = hasHigh ? (high ? versionParts(high) : null) : lowParts;
    if ((low && lowParts?.length === 0) || (hasHigh && high && highParts?.length === 0)) {
      unknown = true;
      continue;
    }
    const lowInclusive = range.startsWith("[");
    const highInclusive = range.endsWith("]");
    const aboveLow = !lowParts || compare(mc, lowParts) > (lowInclusive ? -1 : 0);
    const belowHigh = !highParts || compare(mc, highParts) < (highInclusive ? 1 : 0);
    if (aboveLow && belowHigh) return true;
  }
  return unknown ? null : false;
}
