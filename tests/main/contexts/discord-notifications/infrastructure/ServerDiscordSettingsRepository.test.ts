import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "pth-discord-"));
vi.mock("electron", () => ({ app: { getPath: () => root } }));
vi.mock("@shared/infrastructure/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ServerDiscordSettingsRepository } from "@main/contexts/discord-notifications/infrastructure/repositories";

const infoPath = (id: string) => path.join(root, "servers", id, "server_info.json");
const writeInfo = (id: string, info: object) => {
  fs.mkdirSync(path.dirname(infoPath(id)), { recursive: true });
  fs.writeFileSync(infoPath(id), JSON.stringify(info));
};
const readInfo = (id: string) => JSON.parse(fs.readFileSync(infoPath(id), "utf-8"));

describe("ServerDiscordSettingsRepository", () => {
  const repo = new ServerDiscordSettingsRepository();

  beforeEach(() => fs.rmSync(path.join(root, "servers"), { recursive: true, force: true }));
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("returns defaults when there is no discord key or no file", () => {
    writeInfo("s1", { name: "Mine" });
    const defaults = { webhook_url: "", relay_chat: true, notify_status: true, notify_joins: false };
    expect(repo.get("s1")).toEqual(defaults);
    expect(repo.get("missing")).toEqual(defaults);
  });

  it("saves under discord and preserves other keys", () => {
    writeInfo("s1", { name: "Mine", type: "paper", version: "1.21" });
    repo.save("s1", { webhook_url: "https://discord.com/api/webhooks/1/a", notify_joins: true });
    expect(readInfo("s1")).toEqual({
      name: "Mine",
      type: "paper",
      version: "1.21",
      discord: {
        webhook_url: "https://discord.com/api/webhooks/1/a",
        relay_chat: false,
        notify_status: false,
        notify_joins: true,
      },
    });
    expect(repo.get("s1").notify_joins).toBe(true);
    expect(repo.serverName("s1")).toBe("Mine");
    expect(repo.serverName("nope")).toBe("nope");
  });

  it("sanitizes input", () => {
    writeInfo("s1", {});
    repo.save("s1", {
      webhook_url: `  ${"a".repeat(600)}  `,
      relay_chat: "yes" as unknown as boolean,
      evil: 1,
    } as never);
    const d = readInfo("s1").discord;
    expect(Object.keys(d).sort()).toEqual(["notify_joins", "notify_status", "relay_chat", "webhook_url"]);
    expect(d.webhook_url).toHaveLength(500);
    expect(d.relay_chat).toBe(false);
  });

  it("rejects path-like server ids", () => {
    for (const id of ["../x", "..", ".", "", "a/b", "a\\b"]) {
      expect(() => repo.get(id)).toThrow();
      expect(() => repo.save(id, {})).toThrow();
    }
  });

  it("throws when the server does not exist", () => {
    expect(() => repo.save("ghost", {})).toThrow();
    expect(fs.existsSync(path.join(root, "servers", "ghost"))).toBe(false);
  });
});
