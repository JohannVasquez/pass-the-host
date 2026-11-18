import { describe, it, expect } from "vitest";
import { checkModRelations } from "@main/contexts/mods/domain/checkModRelations";
import type { ModMetadata } from "@main/contexts/mods/domain/parseModMetadata";

const mod = (fileName: string, over: Partial<ModMetadata>) => ({
  fileName,
  metadata: {
    id: fileName,
    name: fileName.toUpperCase(),
    version: "1.0.0",
    loaders: ["fabric"],
    side: "both",
    dependencies: [],
    provides: [],
    ...over,
  } as ModMetadata,
});
const req = (id: string, range?: string) => ({ id, range, kind: "required" as const });

describe("checkModRelations", () => {
  it("reports a missing required dependency", () => {
    const r = checkModRelations([mod("a", { dependencies: [req("lib", ">=1")] })], "fabric", "1.21");
    expect(r.get("a")).toEqual([{ reason: "missing_dependency", dependency: "lib", required: ">=1" }]);
  });

  it("accepts a dependency satisfied through provides", () => {
    const r = checkModRelations(
      [mod("a", { dependencies: [req("module")] }), mod("api", { provides: ["module"] })],
      "fabric",
      "1.21",
    );
    expect(r.size).toBe(0);
  });

  it("warns on a version outside the range", () => {
    const r = checkModRelations(
      [mod("a", { dependencies: [req("lib", ">=2")] }), mod("lib", { version: "1.5.0" })],
      "fabric",
      "1.21",
    );
    expect(r.get("a")).toEqual([
      { reason: "dependency_version", dependency: "lib", required: ">=2", actual: "1.5.0" },
    ]);
  });

  it("ignores +build and minecraft-version prefixes", () => {
    const r = checkModRelations(
      [
        mod("a", { dependencies: [req("lib", ">=11.1.0"), req("other", ">=4.0.0")] }),
        mod("lib", { version: "11.1.106+fabric" }),
        mod("other", { version: "1.20.1-4.2.0" }),
      ],
      "fabric",
      "1.20.1",
    );
    expect(r.size).toBe(0);
  });

  it("does not warn when the version can't be parsed", () => {
    const r = checkModRelations(
      [mod("a", { dependencies: [req("lib", ">=2")] }), mod("lib", { version: "unknown" })],
      "fabric",
      "1.21",
    );
    expect(r.size).toBe(0);
  });

  it("flags duplicates on both jars", () => {
    const r = checkModRelations([mod("a.jar", { id: "x" }), mod("b.jar", { id: "x" })], "fabric", "1.21");
    expect(r.get("a.jar")).toEqual([{ reason: "duplicate", otherFile: "b.jar" }]);
    expect(r.get("b.jar")).toEqual([{ reason: "duplicate", otherFile: "a.jar" }]);
  });

  it("flags breaks with * and conflicts as soft", () => {
    const r = checkModRelations(
      [
        mod("a", { dependencies: [{ id: "b", range: "*", kind: "breaks" }, { id: "c", kind: "conflicts" }] }),
        mod("b", {}),
        mod("c", {}),
      ],
      "fabric",
      "1.21",
    );
    expect(r.get("a")).toEqual([
      { reason: "breaks", other: "B", soft: false },
      { reason: "breaks", other: "C", soft: true },
    ]);
  });

  it("compares plugin ids case-insensitively", () => {
    const r = checkModRelations(
      [mod("p", { loaders: ["plugin"], dependencies: [req("vault")] }), mod("v", { id: "Vault" })],
      "paper",
      "1.21",
    );
    expect(r.size).toBe(0);
  });
});

describe("checkModRelations, real-world cases", () => {
  it("ignores a Fabric+Forge jar's fabric dependencies on a NeoForge server", () => {
    const r = checkModRelations(
      [
        mod("collective", {
          loaders: ["fabric", "neoforge"],
          dependencies: [{ ...req("fabric"), loader: "fabric" }],
        }),
      ],
      "neoforge",
      "1.21.1",
    );
    expect(r.get("collective")).toBeUndefined();
  });

  it("strips the Minecraft prefix from the range too", () => {
    const r = checkModRelations(
      [
        mod("spells", { loaders: ["neoforge"], dependencies: [req("irons_lib", "[1.21.1-1,1.21.1-2)")] }),
        mod("irons_lib", { loaders: ["neoforge"], version: "1.21.1-1.0.2" }),
      ],
      "neoforge",
      "1.21.1",
    );
    expect(r.get("spells")).toBeUndefined();
  });
});
