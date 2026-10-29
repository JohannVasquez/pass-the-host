import { afterEach, describe, expect, it } from "vitest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ClientMod,
  computePlan,
  fingerprintDirs,
  finishFolder,
  managedToRemove,
  planFolder,
  STATE_FILE,
  validateClientMod,
  validateManifest,
  writeSyncedModTo,
} from "@main/contexts/mods/infrastructure/ModSync";
import { isModrinthCdnUrl } from "@main/contexts/mods/infrastructure/modrinthLookup";

const sha = (b: Buffer | string): string => crypto.createHash("sha1").update(b).digest("hex");
const mod = (data: string, over: Partial<ClientMod> = {}): ClientMod => ({
  sha1: sha(data),
  fileName: "a.jar",
  size: data.length,
  name: "A",
  side: "both",
  ...over,
});

describe("validateClientMod", () => {
  it("accepts a plain mod", () => {
    expect(validateClientMod(mod("x")).fileName).toBe("a.jar");
  });
  it.each([
    ["bad hash", { sha1: "ABC" }],
    ["upper-case hash", { sha1: "A".repeat(40) }],
    ["traversal", { fileName: "../a.jar" }],
    ["separator", { fileName: "x/a.jar" }],
    ["backslash", { fileName: "x\\a.jar" }],
    ["dot dot", { fileName: ".." }],
    ["not a jar", { fileName: "a.exe" }],
    ["state file", { fileName: ".passthehost-mods.json" }],
    ["negative size", { size: -1 }],
    ["NaN size", { size: NaN }],
    ["huge size", { size: 600 * 1024 * 1024 }],
    ["server side", { side: "server" }],
  ])("rejects %s", (_n, over) => {
    expect(() => validateClientMod({ ...mod("x"), ...over })).toThrow();
  });
  it("drops a non-Modrinth url instead of trusting it", () => {
    expect(validateClientMod({ ...mod("x"), url: "https://evil.com/a.jar" }).url).toBeUndefined();
  });
});

describe("isModrinthCdnUrl", () => {
  it("only takes https on cdn.modrinth.com", () => {
    expect(isModrinthCdnUrl("https://cdn.modrinth.com/data/a/versions/b/a.jar")).toBe(true);
    for (const bad of [
      "http://cdn.modrinth.com/a.jar",
      "https://cdn.modrinth.com.evil.com/a.jar",
      "https://evil.com/cdn.modrinth.com/",
      "https://cdn.modrinth.com@evil.com/a.jar",
      "https://user:pw@cdn.modrinth.com/a.jar",
      "https://cdn.modrinth.com:8443/a.jar",
      "nope",
      undefined,
    ]) {
      expect(isModrinthCdnUrl(bad)).toBe(false);
    }
  });
});

describe("validateManifest", () => {
  it("drops repeated hashes and names, rejects bad entries", () => {
    const m = validateManifest({
      serverName: "S",
      engine: "fabric",
      minecraftVersion: "1.21",
      mods: [mod("x"), mod("x"), mod("y")],
    });
    expect(m.mods).toHaveLength(1);
    expect(() => validateManifest({ mods: [{ ...mod("x"), fileName: "../x.jar" }] })).toThrow();
    expect(() => validateManifest({})).toThrow();
  });
});

describe("computePlan / managedToRemove", () => {
  const a = mod("a", { fileName: "a.jar" });
  const b = mod("b", { fileName: "b.jar" });
  it("downloads only what is missing, counts present ones, removes dropped managed files", () => {
    const plan = computePlan([a, b], new Set([a.sha1]), { "old.jar": sha("old"), "a.jar": a.sha1 });
    expect(plan.download).toEqual([b]);
    expect(plan.upToDate).toBe(1);
    expect(plan.remove).toEqual(["old.jar"]);
  });
  it("never removes unmanaged files or invalid names", () => {
    expect(managedToRemove({ "../evil.jar": sha("x"), "ok.jar": sha("y") }, new Set())).toEqual([
      "ok.jar",
    ]);
  });
});

describe("folder operations", () => {
  const dirs: string[] = [];
  const tmp = (): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "pth-sync-"));
    dirs.push(d);
    return d;
  };
  afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it("writes verified bytes, records them, and refuses a wrong hash without leaving files", async () => {
    const dir = tmp();
    await writeSyncedModTo(dir, mod("hello"), Buffer.from("hello"));
    expect(fs.readFileSync(path.join(dir, "a.jar"), "utf-8")).toBe("hello");
    expect(JSON.parse(fs.readFileSync(path.join(dir, STATE_FILE), "utf-8")).managed).toEqual({
      "a.jar": sha("hello"),
    });
    const other = tmp();
    await expect(writeSyncedModTo(other, mod("hello"), Buffer.from("tampered"))).rejects.toThrow();
    expect(fs.readdirSync(other)).toEqual([]);
  });

  it("does not overwrite someone else's jar of the same name", async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "a.jar"), "mine");
    await writeSyncedModTo(dir, mod("theirs"), Buffer.from("theirs"));
    expect(fs.readFileSync(path.join(dir, "a.jar"), "utf-8")).toBe("mine");
    expect(fs.readFileSync(path.join(dir, "a-pth.jar"), "utf-8")).toBe("theirs");
  });

  it("updates a managed jar in place", async () => {
    const dir = tmp();
    await writeSyncedModTo(dir, mod("v1"), Buffer.from("v1"));
    await writeSyncedModTo(dir, mod("v2"), Buffer.from("v2"));
    expect(fs.readdirSync(dir).filter((n) => n.endsWith(".jar"))).toEqual(["a.jar"]);
    expect(fs.readFileSync(path.join(dir, "a.jar"), "utf-8")).toBe("v2");
  });

  it("plans by hash across the folder and only removes managed files", async () => {
    const dir = tmp();
    const m = (n: string): ClientMod => mod(n, { fileName: `${n}.jar` });
    fs.writeFileSync(path.join(dir, "renamed.jar"), "have"); // friend's own copy of a wanted mod
    fs.writeFileSync(path.join(dir, "own.jar"), "own"); // friend's unrelated mod
    await writeSyncedModTo(dir, m("gone"), Buffer.from("gone"));
    const manifest = validateManifest({ serverName: "S", mods: [m("have"), m("need")] });
    const plan = await planFolder(dir, manifest);
    expect(plan.download.map((x) => x.fileName)).toEqual(["need.jar"]);
    expect(plan.upToDate).toBe(1);
    expect(plan.remove).toEqual(["gone.jar"]);

    expect(await finishFolder(dir, manifest)).toEqual({ removed: 1 });
    expect(fs.existsSync(path.join(dir, "gone.jar"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "own.jar"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "renamed.jar"))).toBe(true);
  });

  it("keeps a managed file the friend has since replaced", async () => {
    const dir = tmp();
    await writeSyncedModTo(dir, mod("old"), Buffer.from("old"));
    fs.writeFileSync(path.join(dir, "a.jar"), "edited by friend");
    expect(await finishFolder(dir, validateManifest({ serverName: "S", mods: [] }))).toEqual({
      removed: 0,
    });
    expect(fs.existsSync(path.join(dir, "a.jar"))).toBe(true);
  });
});

describe("fingerprintDirs", () => {
  it("changes when a jar is added, replaced or removed and ignores other files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pth-fp-"));
    try {
      const empty = await fingerprintDirs([dir, path.join(dir, "missing")]);
      fs.writeFileSync(path.join(dir, "notes.txt"), "x");
      expect(await fingerprintDirs([dir])).toBe(empty);
      fs.writeFileSync(path.join(dir, "a.jar"), "one");
      const one = await fingerprintDirs([dir]);
      expect(one).not.toBe(empty);
      fs.writeFileSync(path.join(dir, "a.jar"), "three!");
      const replaced = await fingerprintDirs([dir]);
      expect(replaced).not.toBe(one);
      fs.rmSync(path.join(dir, "a.jar"));
      expect(await fingerprintDirs([dir])).toBe(empty);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
