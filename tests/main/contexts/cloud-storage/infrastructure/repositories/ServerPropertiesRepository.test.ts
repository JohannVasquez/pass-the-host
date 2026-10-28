import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerPropertiesRepository } from "@main/contexts/cloud-storage/infrastructure/repositories/ServerPropertiesRepository";

let userDataPath = "";
const dialog = vi.hoisted(() => ({ showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => userDataPath) },
  dialog,
  shell: { showItemInFolder: vi.fn() },
  BrowserWindow: { getFocusedWindow: () => ({}), getAllWindows: () => [] },
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

describe("ServerPropertiesRepository world", () => {
  let serverPath = "";
  const makeWorld = (name: string, marker = name): void => {
    fs.mkdirSync(path.join(serverPath, name, "region"), { recursive: true });
    fs.writeFileSync(path.join(serverPath, name, "level.dat"), marker);
  };
  const pendingUpload = (): boolean =>
    JSON.parse(fs.readFileSync(path.join(serverPath, ".cloud-sync-state.json"), "utf-8"))
      .localChangesPendingUpload;

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-world-"));
    serverPath = path.join(userDataPath, "servers", "s1");
    fs.mkdirSync(path.join(serverPath, "mods"), { recursive: true });
    fs.writeFileSync(path.join(serverPath, "server.properties"), "level-name=world\n");
  });

  it("resets every dimension folder and never leaves the server folder", async () => {
    makeWorld("world");
    makeWorld("world_nether");
    makeWorld("old");
    fs.writeFileSync(path.join(userDataPath, "servers", "level.dat"), "outside");

    await new ServerPropertiesRepository().resetWorld("s1", ["world", "old", "", ".", ".."]);

    expect(fs.readdirSync(serverPath).sort()).toEqual([
      ".cloud-sync-state.json",
      "mods",
      "server.properties",
    ]);
    expect(fs.existsSync(path.join(userDataPath, "servers", "level.dat"))).toBe(true);
    expect(pendingUpload()).toBe(true);
  });

  it("round-trips a world through export and import", async () => {
    makeWorld("world", "original");
    makeWorld("world_nether", "nether");
    const zipPath = path.join(userDataPath, "export.zip");
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: zipPath });
    const repo = new ServerPropertiesRepository();

    await expect(repo.exportWorld("s1")).resolves.toBe("done");

    await repo.resetWorld("s1", ["world"]);
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [zipPath] });
    await expect(repo.importWorld("s1")).resolves.toBe("done");
    // The overworld, not Paper's world_nether that sits next to it in the zip
    expect(fs.readFileSync(path.join(serverPath, "world", "level.dat"), "utf-8")).toBe("original");
  });

  it("imports a singleplayer folder through its level.dat, without its session.lock", async () => {
    const save = path.join(userDataPath, "saves", "Mi Mundo");
    fs.mkdirSync(save, { recursive: true });
    fs.writeFileSync(path.join(save, "level.dat"), "sp");
    fs.writeFileSync(path.join(save, "session.lock"), "");
    makeWorld("world", "old");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [path.join(save, "level.dat")],
    });

    await expect(new ServerPropertiesRepository().importWorld("s1")).resolves.toBe("done");
    expect(fs.readFileSync(path.join(serverPath, "world", "level.dat"), "utf-8")).toBe("sp");
    expect(fs.existsSync(path.join(serverPath, "world", "session.lock"))).toBe(false);
  });

  it("reports a missing world and files that aren't one", async () => {
    const repo = new ServerPropertiesRepository();
    await expect(repo.exportWorld("s1")).resolves.toBe("no-world");

    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [path.join(serverPath, "server.properties")],
    });
    await expect(repo.importWorld("s1")).resolves.toBe("invalid");
  });
});
