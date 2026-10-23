import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerPropertiesRepository } from "@main/contexts/cloud-storage/infrastructure/repositories/ServerPropertiesRepository";

let userDataPath = "";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => userDataPath) },
}));

describe("ServerPropertiesRepository", () => {
  let propertiesPath = "";

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-props-"));
    fs.mkdirSync(path.join(userDataPath, "servers", "s1"), { recursive: true });
    propertiesPath = path.join(userDataPath, "servers", "s1", "server.properties");
    fs.writeFileSync(
      propertiesPath,
      "#Minecraft server properties\nlevel-type=minecraft\\:normal\nmotd=\\u00A7aHola\ndifficulty=easy\n",
    );
  });

  it("reads and unescapes values", () => {
    expect(new ServerPropertiesRepository().readAll("s1")).toEqual({
      "level-type": "minecraft:normal",
      motd: "§aHola",
      difficulty: "easy",
    });
  });

  it("updates keys in place, appends new ones and round-trips escapes", () => {
    const repo = new ServerPropertiesRepository();
    repo.writeAll("s1", { difficulty: "hard", motd: "ñ = #1", "level-seed": "abc" });

    expect(fs.readFileSync(propertiesPath, "utf-8")).toBe(
      "#Minecraft server properties\nlevel-type=minecraft\\:normal\nmotd=\\u00f1 \\= \\#1\ndifficulty=hard\nlevel-seed=abc",
    );
    expect(repo.readAll("s1")).toMatchObject({
      motd: "ñ = #1",
      difficulty: "hard",
      "level-seed": "abc",
    });
  });

  it("returns empty / false when the file is missing", () => {
    const repo = new ServerPropertiesRepository();
    expect(repo.readAll("missing")).toEqual({});
    expect(repo.writeAll("missing", { pvp: "false" })).toBe(false);
  });
});

describe("ServerPropertiesRepository whitelist", () => {
  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-wl-"));
    fs.mkdirSync(path.join(userDataPath, "servers", "s1"), { recursive: true });
  });

  it("round-trips whitelist.json and tolerates a missing file", () => {
    const repo = new ServerPropertiesRepository();
    expect(repo.readWhitelist("s1")).toEqual([]);
    const entries = [{ uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", name: "Notch" }];
    expect(repo.writeWhitelist("s1", entries)).toBe(true);
    expect(repo.readWhitelist("s1")).toEqual(entries);
  });

  it("computes the vanilla offline UUID without calling Mojang", async () => {
    // Known value: UUID.nameUUIDFromBytes("OfflinePlayer:Notch")
    await expect(new ServerPropertiesRepository().lookupPlayer("Notch", false)).resolves.toEqual({
      uuid: "b50ad385-829d-3141-a216-7e7d7539ba7f",
      name: "Notch",
    });
  });

  it("rejects invalid names", async () => {
    await expect(new ServerPropertiesRepository().lookupPlayer("bad name!", false)).resolves.toBe(
      null,
    );
  });
});
