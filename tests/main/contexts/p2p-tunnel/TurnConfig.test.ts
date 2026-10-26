import { describe, it, expect, vi, beforeEach } from "vitest";

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock("@main/contexts/p2p-tunnel/infrastructure/SecureStore", () => ({
  readSecureJson: (name: string) => store.get(name) ?? null,
  writeSecureJson: (name: string, value: unknown) => store.set(name, value),
  removeSecureJson: (name: string) => store.delete(name),
}));
vi.mock("@shared/infrastructure/logger", () => ({ logger: { warn: vi.fn() } }));

import {
  getIceServers,
  loadTurnConfig,
  saveTurnConfig,
} from "@main/contexts/p2p-tunnel/infrastructure/TurnConfig";

const STUN = { urls: "stun:stun.cloudflare.com:3478" };
const KEY_ID = "0123456789abcdef0123456789abcdef";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const cloudflareAnswers = (status: number): void => {
  fetchMock.mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => ({
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
        {
          urls: [
            "turn:turn.cloudflare.com:3478?transport=udp",
            "turn:turn.cloudflare.com:53?transport=udp",
          ],
          username: "u",
          credential: "c",
        },
      ],
    }),
  });
};

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
});

describe("TurnConfig", () => {
  it("is STUN-only when no TURN server is configured", async () => {
    expect(await getIceServers()).toEqual({ iceServers: [STUN] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds a static TURN server", async () => {
    await saveTurnConfig({
      type: "static",
      urls: [" turn:my.host:3478 ", "", "turns:my.host:5349"],
      username: " me ",
      credential: "pw",
    });

    expect((await getIceServers()).iceServers).toEqual([
      STUN,
      { urls: ["turn:my.host:3478", "turns:my.host:5349"], username: "me", credential: "pw" },
    ]);
  });

  it.each([
    { type: "static", urls: ["stun:my.host"], username: "me", credential: "pw" },
    { type: "static", urls: ["https://my.host"], username: "me", credential: "pw" },
    { type: "static", urls: [], username: "me", credential: "pw" },
    { type: "static", urls: ["turn:my.host"], username: " ", credential: "pw" },
    { type: "static", urls: ["turn:my.host"], username: "me", credential: "" },
    { type: "cloudflare", keyId: "not-a-key", apiToken: "token" },
    { type: "cloudflare", keyId: KEY_ID, apiToken: " " },
  ] as const)("rejects invalid config %o", async (config) => {
    await expect(saveTurnConfig(config)).rejects.toThrow("invalid_turn_config");
    expect(loadTurnConfig()).toBeNull();
  });

  it("checks a Cloudflare key with Cloudflare before saving it", async () => {
    cloudflareAnswers(401);

    await expect(
      saveTurnConfig({ type: "cloudflare", keyId: KEY_ID, apiToken: "bad" }),
    ).rejects.toThrow("invalid_cloudflare_turn");
    expect(loadTurnConfig()).toBeNull();
  });

  it("mints 48 h Cloudflare credentials per connection, without port 53", async () => {
    cloudflareAnswers(200);
    await saveTurnConfig({ type: "cloudflare", keyId: ` ${KEY_ID} `, apiToken: " token " });

    const { iceServers } = await getIceServers();

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`,
    );
    expect(init.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(init.body)).toEqual({ ttl: 172800 });
    expect(iceServers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" },
    ]);
  });

  it("falls back to STUN when Cloudflare is unreachable", async () => {
    cloudflareAnswers(200);
    await saveTurnConfig({ type: "cloudflare", keyId: KEY_ID, apiToken: "token" });
    fetchMock.mockRejectedValue(new Error("offline"));

    expect(await getIceServers()).toEqual({ iceServers: [STUN] });
  });

  it("null removes the TURN server", async () => {
    await saveTurnConfig({
      type: "static",
      urls: ["turn:my.host"],
      username: "me",
      credential: "pw",
    });
    await saveTurnConfig(null);
    expect(loadTurnConfig()).toBeNull();
  });
});
