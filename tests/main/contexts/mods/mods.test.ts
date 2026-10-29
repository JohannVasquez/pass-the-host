import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { deflateRawSync } from "zlib";
import { parseModMetadata, ModMetadata } from "@main/contexts/mods/domain/parseModMetadata";
import { checkModCompatibility, targetFolder } from "@main/contexts/mods/domain/checkModCompatibility";
import {
  metadataFromModrinth,
  ModrinthInfo,
  sideFromModrinth,
} from "@main/contexts/mods/infrastructure/modrinthLookup";
import { readZipEntries } from "@main/contexts/mods/infrastructure/readZipEntries";

const entries = (files: Record<string, string>): Map<string, Buffer> =>
  new Map(Object.entries(files).map(([k, v]) => [k, Buffer.from(v)]));

const meta = (over: Partial<ModMetadata>): ModMetadata => ({
  id: "x",
  name: "X",
  version: "1",
  loaders: ["fabric"],
  side: "both",
  ...over,
});

describe("parseModMetadata", () => {
  it("parses fabric.mod.json, joining array requirements", () => {
    const result = parseModMetadata(
      entries({
        "fabric.mod.json": JSON.stringify({
          id: "sodium",
          version: "0.6.0",
          environment: "client",
          depends: { minecraft: [">=1.21", "1.20.x"] },
        }),
      }),
    );
    expect(result).toEqual({
      id: "sodium",
      name: "sodium",
      version: "0.6.0",
      loaders: ["fabric"],
      minecraft: ">=1.21 || 1.20.x",
      side: "client",
      description: undefined,
    });
  });

  it("tolerates raw newlines inside fabric strings", () => {
    const result = parseModMetadata(
      entries({ "fabric.mod.json": '{"id":"a","version":"1","description":"line1\nline2"}' }),
    );
    expect(result?.description).toBe("line1\nline2");
  });

  it("parses quilt.mod.json", () => {
    const result = parseModMetadata(
      entries({
        "quilt.mod.json": JSON.stringify({
          quilt_loader: {
            id: "qmod",
            version: "2.0",
            metadata: { name: "Q Mod" },
            depends: ["other", { id: "minecraft", versions: ">=1.20" }],
          },
          minecraft: { environment: "dedicated_server" },
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "qmod",
      name: "Q Mod",
      version: "2.0",
      loaders: ["quilt"],
      minecraft: ">=1.20",
      side: "server",
    });
  });

  it("parses neoforge.mods.toml with the manifest version fallback", () => {
    const result = parseModMetadata(
      entries({
        "META-INF/neoforge.mods.toml": `modLoader="javafml"
[[mods]]
modId = "cool"  # comment
version = "\${file.jarVersion}"
displayName = 'Cool Mod'
description = '''
Multi
line
'''
[[dependencies.cool]]
modId = "minecraft"
versionRange = "[1.21,1.22)"
`,
        "META-INF/MANIFEST.MF": "Manifest-Version: 1.0\r\nImplementation-Version: 3.4.5\r\n",
      }),
    );
    expect(result).toMatchObject({
      id: "cool",
      name: "Cool Mod",
      version: "3.4.5",
      loaders: ["neoforge"],
      minecraft: "[1.21,1.22)",
      side: "both",
    });
    expect(result?.description).toContain("Multi");
  });

  it("reads inline TOML tables (mods = [{ ... }] and [dependencies] arrays)", () => {
    const toml = `modLoader = 'javafml'
mods = [
	{ modId = 'dnt', version = '1-v2.4', displayName = 'Dungeons, Taverns', description = "isn't in the main pack" },
]
[dependencies]
dnt = [
	{ modId = "minecraft", type = "required", versionRange = "[1.21,1.22)", side = "BOTH" },
]
`;
    expect(parseModMetadata(entries({ "META-INF/neoforge.mods.toml": toml }))).toMatchObject({
      id: "dnt",
      name: "Dungeons, Taverns",
      version: "1-v2.4",
      minecraft: "[1.21,1.22)",
      loaders: ["neoforge"],
    });
  });

  it("reports mods.toml as forge, or neoforge with a neoforge dependency", () => {
    const toml = (dep: string): string => `[[mods]]
modId="m"
version="1.0"
[[dependencies.m]]
modId="${dep}"
versionRange="[1,)"
[[dependencies.m]]
modId="minecraft"
versionRange="[1.20.1]"
`;
    expect(parseModMetadata(entries({ "META-INF/mods.toml": toml("forge") }))).toMatchObject({
      loaders: ["forge"],
      minecraft: "[1.20.1]",
      name: "m",
    });
    expect(parseModMetadata(entries({ "META-INF/mods.toml": toml("neoforge") }))?.loaders).toEqual([
      "neoforge",
    ]);
  });

  it("parses mcmod.info (v1 array and v2 modList)", () => {
    const v1 = JSON.stringify([{ modid: "old", name: "Old", version: "1.0", mcversion: "1.12.2" }]);
    expect(parseModMetadata(entries({ "mcmod.info": v1 }))).toMatchObject({
      id: "old",
      loaders: ["forge"],
      minecraft: "1.12.2",
    });
    const v2 = JSON.stringify({ modList: [{ modid: "old2", version: "${version}" }] });
    expect(parseModMetadata(entries({ "mcmod.info": v2 }))).toMatchObject({
      id: "old2",
      version: "unknown",
    });
  });

  it("parses plugin.yml", () => {
    const result = parseModMetadata(
      entries({
        "plugin.yml": "name: 'EssentialsX'\nversion: \"2.20\"\napi-version: 1.20\nmain: a.b.C\n",
      }),
    );
    expect(result).toMatchObject({
      id: "essentialsx",
      name: "EssentialsX",
      version: "2.20",
      loaders: ["plugin"],
      minecraft: "1.20",
      side: "server",
    });
  });

  it("collects loaders from a multi-loader jar", () => {
    const result = parseModMetadata(
      entries({
        "fabric.mod.json": '{"id":"multi","version":"1"}',
        "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="multi"\nversion="1"\n',
      }),
    );
    expect(result?.loaders).toEqual(["fabric", "neoforge"]);
  });

  it("returns null when nothing matches", () => {
    expect(
      parseModMetadata(entries({ "META-INF/MANIFEST.MF": "Manifest-Version: 1.0\n" })),
    ).toBeNull();
  });
});

describe("checkModCompatibility", () => {
  it("warns on jars without metadata and rejects wrong loaders", () => {
    expect(checkModCompatibility(null, "fabric", "1.21")).toEqual({
      status: "warning",
      reason: "not_a_mod",
    });
    expect(checkModCompatibility(meta({}), "neoforge", "1.21.1")).toMatchObject({
      status: "error",
      reason: "wrong_loader",
      engine: "neoforge",
    });
    expect(checkModCompatibility(meta({}), "vanilla", "1.21.1")).toMatchObject({
      reason: "wrong_loader",
    });
  });

  it("accepts fabric mods on quilt and forge mods on neoforge 1.20.1 only", () => {
    expect(checkModCompatibility(meta({}), "quilt", "1.21")).toEqual({ status: "ok" });
    const forge = meta({ loaders: ["forge"] });
    expect(checkModCompatibility(forge, "neoforge", "1.20.1")).toEqual({ status: "ok" });
    expect(checkModCompatibility(forge, "neoforge", "1.21.1")).toMatchObject({
      reason: "wrong_loader",
    });
  });

  it("only warns when the range misses the server by a patch version", () => {
    const m = meta({ loaders: ["neoforge"], minecraft: "[1.21,1.21.1)" });
    expect(checkModCompatibility(m, "neoforge", "1.21.1")).toEqual({
      status: "warning",
      reason: "other_patch",
      required: "[1.21,1.21.1)",
      actual: "1.21.1",
    });
  });

  it("checks maven ranges", () => {
    const m = meta({ loaders: ["neoforge"], minecraft: "[1.20.1,1.21)" });
    expect(checkModCompatibility(m, "neoforge", "1.21.1")).toEqual({
      status: "error",
      reason: "wrong_minecraft",
      required: "[1.20.1,1.21)",
      actual: "1.21.1",
    });
    expect(checkModCompatibility(m, "neoforge", "1.20.4")).toEqual({ status: "ok" });
    const union = meta({ loaders: ["neoforge"], minecraft: "[1.18,1.19),[1.20,1.21)" });
    expect(checkModCompatibility(union, "neoforge", "1.20.2")).toEqual({ status: "ok" });
    expect(checkModCompatibility(union, "neoforge", "1.19.4")).toMatchObject({ status: "error" });
    const open = meta({ loaders: ["neoforge"], minecraft: "(,1.21)" });
    expect(checkModCompatibility(open, "neoforge", "1.20.6")).toEqual({ status: "ok" });
    const bare = meta({ loaders: ["neoforge"], minecraft: "1.20.1" });
    expect(checkModCompatibility(bare, "neoforge", "1.21")).toEqual({ status: "ok" });
  });

  it("checks fabric predicates", () => {
    const ok = (minecraft: string, mc: string): string =>
      checkModCompatibility(meta({ minecraft }), "fabric", mc).status;
    expect(ok(">=1.21", "1.21.1")).toBe("ok");
    expect(ok("~1.20.1", "1.20.4")).toBe("ok");
    expect(ok("~1.20.1", "1.21")).toBe("error");
    expect(ok("^1.20", "1.21.4")).toBe("ok");
    expect(ok("1.21.x", "1.21.4")).toBe("ok");
    expect(ok("1.21.*", "1.20.4")).toBe("error");
    expect(ok(">=1.21.2-alpha.24.33.a", "1.21.4")).toBe("ok");
    expect(ok(">=1.20 <1.21", "1.20.1")).toBe("ok");
    expect(ok(">=1.20 <1.21", "1.21")).toBe("error");
    expect(ok("1.20.1 || 1.21", "1.21.0")).toBe("ok");
    expect(ok("*", "1.0")).toBe("ok");
    expect(ok("26.1", "26.1")).toBe("ok");
    expect(ok("what", "1.21")).toBe("warning");
  });

  it("warns for client-only mods", () => {
    expect(checkModCompatibility(meta({ side: "client" }), "fabric", "1.21")).toEqual({
      status: "warning",
      reason: "client_only",
    });
  });

  it("treats plugin api-version as a minimum", () => {
    const plugin = meta({ loaders: ["plugin"], minecraft: "1.20", side: "server" });
    expect(checkModCompatibility(plugin, "paper", "1.21.1")).toEqual({ status: "ok" });
    expect(checkModCompatibility(plugin, "paper", "1.19.4")).toMatchObject({
      reason: "wrong_minecraft",
    });
  });

  it("matches legacy forge mcmod.info on major.minor", () => {
    const old = meta({ loaders: ["forge"], minecraft: "1.12" });
    expect(checkModCompatibility(old, "forge", "1.12.2")).toEqual({ status: "ok" });
    expect(checkModCompatibility(old, "forge", "1.11.2")).toMatchObject({ status: "error" });
  });
});

describe("readZipEntries", () => {
  function crc32(buf: Buffer): number {
    let crc = ~0;
    for (const byte of buf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return ~crc >>> 0;
  }

  function buildZip(files: Array<{ name: string; data: Buffer; deflate: boolean }>): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const { name, data, deflate } of files) {
      const body = deflate ? deflateRawSync(data) : data;
      const nameBuf = Buffer.from(name);
      const extra = Buffer.alloc(4); // local extra differs from central (none)
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(deflate ? 8 : 0, 8);
      local.writeUInt32LE(crc32(data), 14);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(extra.length, 28);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(deflate ? 8 : 0, 10);
      central.writeUInt32LE(crc32(data), 16);
      central.writeUInt32LE(body.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(nameBuf.length, 28);
      central.writeUInt32LE(offset, 42);
      locals.push(local, nameBuf, extra, body);
      centrals.push(central, nameBuf);
      offset += 30 + nameBuf.length + extra.length + body.length;
    }
    const cd = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, eocd]);
  }

  it("reads stored and deflated entries, skipping missing ones", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-zip-"));
    try {
      const file = path.join(dir, "a.jar");
      fs.writeFileSync(
        file,
        buildZip([
          { name: "stored.txt", data: Buffer.from("hello stored"), deflate: false },
          { name: "deflated.txt", data: Buffer.from("hello ".repeat(100)), deflate: true },
          { name: "other.txt", data: Buffer.from("nope"), deflate: false },
        ]),
      );
      const result = readZipEntries(file, ["stored.txt", "deflated.txt", "missing.txt"]);
      expect([...result.keys()].sort()).toEqual(["deflated.txt", "stored.txt"]);
      expect(result.get("stored.txt")?.toString()).toBe("hello stored");
      expect(result.get("deflated.txt")?.toString()).toBe("hello ".repeat(100));

      fs.writeFileSync(file, "not a zip at all, definitely");
      expect(() => readZipEntries(file, ["x"])).toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("derives forge/neoforge side from displayTest and clientSideOnly", () => {
    const side = (top: string, displayTest = ""): string | undefined =>
      parseModMetadata(
        entries({
          "META-INF/mods.toml": `${top}\n[[mods]]\nmodId="m"\nversion="1"\n${displayTest}\n`,
        }),
      )?.side;
    expect(side("", 'displayTest="IGNORE_SERVER_VERSION"')).toBe("server");
    expect(side("", 'displayTest="IGNORE_ALL_VERSION"')).toBe("client");
    expect(side("clientSideOnly = true")).toBe("client");
    expect(side("")).toBe("both");
  });

  it("maps Modrinth client/server flags to a side and a stand-in metadata", () => {
    const info = (clientSide: ModrinthInfo["clientSide"], serverSide: ModrinthInfo["serverSide"]) =>
      ({
        projectId: "p",
        slug: "kff",
        title: "Kotlin for Forge",
        versionNumber: "5.0",
        loaders: ["neoforge", "bukkit", "datapack"],
        clientSide,
        serverSide,
      }) satisfies ModrinthInfo;
    expect(sideFromModrinth(info("required", "unsupported"))).toBe("client");
    expect(sideFromModrinth(info("unsupported", "required"))).toBe("server");
    expect(sideFromModrinth(info("required", "required"))).toBe("both");
    expect(sideFromModrinth(info("optional", "unknown"))).toBe("both");
    expect(metadataFromModrinth(info("required", "required"))).toEqual({
      id: "kff",
      name: "Kotlin for Forge",
      version: "5.0",
      loaders: ["neoforge", "plugin"],
      side: "both",
    });
  });
});

describe("client-only mods folder", () => {
  it("targetFolder sends client mods apart, everything else to the loader folder", () => {
    expect(targetFolder("client", "fabric")).toBe("client-mods");
    expect(targetFolder("both", "fabric")).toBe("mods");
    expect(targetFolder("server", "forge")).toBe("mods");
    expect(targetFolder("client", "paper")).toBe("plugins");
  });

  it("client_only warns in mods/ but is ok in client-mods/", () => {
    const client = meta({ side: "client" });
    expect(checkModCompatibility(client, "fabric", "1.21.1")).toEqual({
      status: "warning",
      reason: "client_only",
    });
    expect(checkModCompatibility(client, "fabric", "1.21.1", "client-mods")).toEqual({
      status: "ok",
    });
  });

  it("still rejects a wrong loader inside client-mods/", () => {
    expect(
      checkModCompatibility(meta({ side: "client", loaders: ["forge"] }), "fabric", "1.21.1", "client-mods")
        .status,
    ).toBe("error");
  });
});
