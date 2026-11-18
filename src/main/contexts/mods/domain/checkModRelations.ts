import { acceptedLoaders, matchesMinecraft } from "./checkModCompatibility";
import type { BareStyle } from "./checkModCompatibility";
import type { ModMetadata } from "./parseModMetadata";

export type ModRelationIssue =
  | { reason: "missing_dependency"; dependency: string; required?: string }
  | { reason: "dependency_version"; dependency: string; required: string; actual: string }
  | { reason: "duplicate"; otherFile: string }
  | { reason: "breaks"; other: string; soft: boolean };

/** Drops the Minecraft prefix and build metadata: "1.20.1-4.2.0" -> "4.2.0", "11.1.106+fabric" -> "11.1.106".
 * Applied to ranges too, so "[1.21.1-1,1.21.1-2)" -> "[1,2)" */
function normalizeVersion(version: string, mcVersion: string): string {
  return version.split(`${mcVersion}-`).join("").replace(/\+[^\s,\])]*/g, "");
}

/**
 * Dependency, duplicate and incompatibility problems between the mods the server loads.
 * Pass only server-loaded mods: client-mods/ jars never load on the server, so they neither
 * satisfy a dependency nor conflict. Every issue is a warning, nothing here blocks a start.
 */
export function checkModRelations(
  mods: { fileName: string; metadata: ModMetadata | null }[],
  engine: string,
  mcVersion: string,
): Map<string, ModRelationIssue[]> {
  const key = (id: string): string => (engine === "paper" ? id.toLowerCase() : id);
  const accepted = acceptedLoaders(engine, mcVersion);
  const installed = new Map<string, { version: string; name: string } | null>(); // null: provided only
  const byId = new Map<string, string[]>();
  for (const { fileName, metadata: m } of mods) {
    if (!m) continue;
    installed.set(key(m.id), { version: m.version, name: m.name });
    byId.set(key(m.id), [...(byId.get(key(m.id)) ?? []), fileName]);
  }
  for (const { metadata: m } of mods) {
    for (const id of m?.provides ?? []) if (!installed.has(key(id))) installed.set(key(id), null);
  }

  const result = new Map<string, ModRelationIssue[]>();
  const add = (fileName: string, issue: ModRelationIssue): void => {
    result.set(fileName, [...(result.get(fileName) ?? []), issue]);
  };

  for (const { fileName, metadata: m } of mods) {
    if (!m) continue;
    for (const other of byId.get(key(m.id)) ?? []) {
      if (other !== fileName) add(fileName, { reason: "duplicate", otherFile: other });
    }
    const hasRange = (range?: string): range is string => !!range && range.trim() !== "*";
    for (const dep of m.dependencies) {
      if (dep.loader && !accepted.includes(dep.loader)) continue;
      const loader = dep.loader ?? m.loaders[0];
      const bare: BareStyle = loader === "forge" || loader === "neoforge" ? "minimum" : "exact";
      const matches = (range: string, version: string): boolean | null =>
        matchesMinecraft(normalizeVersion(range, mcVersion), normalizeVersion(version, mcVersion), bare);
      const found = installed.get(key(dep.id));
      if (dep.kind === "required") {
        if (found === undefined) {
          add(fileName, {
            reason: "missing_dependency",
            dependency: dep.id,
            ...(hasRange(dep.range) && { required: dep.range }),
          });
        } else if (found && hasRange(dep.range)) {
          if (matches(dep.range, found.version) === false) {
            add(fileName, {
              reason: "dependency_version",
              dependency: dep.id,
              required: dep.range,
              actual: found.version,
            });
          }
        }
      } else if (found !== undefined) {
        // A provided-only id has no version to test, so only an open-ended declaration counts
        const hits = !hasRange(dep.range) || (found && matches(dep.range, found.version) === true);
        if (hits) {
          add(fileName, { reason: "breaks", other: found?.name ?? dep.id, soft: dep.kind === "conflicts" });
        }
      }
    }
  }
  return result;
}
