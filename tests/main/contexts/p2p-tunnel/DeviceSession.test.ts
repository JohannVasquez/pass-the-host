import { describe, it, expect, vi, beforeEach } from "vitest";

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock("@main/contexts/p2p-tunnel/infrastructure/SecureStore", () => ({
  readSecureJson: (name: string) => store.get(name) ?? null,
  writeSecureJson: (name: string, value: unknown) => store.set(name, value),
  removeSecureJson: (name: string) => store.delete(name),
}));

import { api } from "@main/contexts/p2p-tunnel/infrastructure/DeviceSession";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const reply = (status: number, body: unknown): Response =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
const paths = (): string[] => fetchMock.mock.calls.map(([url]) => new URL(url).pathname);

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
});

describe("DeviceSession", () => {
  it("registers the device once and reuses its token", async () => {
    fetchMock.mockResolvedValueOnce(reply(201, { token: "t1" })).mockResolvedValue(reply(200, []));

    await api("/groups");
    await api("/groups");

    expect(paths()).toEqual(["/api/auth/device", "/api/groups", "/api/groups"]);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer t1");
  });

  it("forgets a rejected token so the next call registers again", async () => {
    store.set("p2p-session", { token: "revoked" });
    fetchMock.mockResolvedValueOnce(reply(401, { error: "unauthorized" }));

    await expect(api("/groups")).rejects.toThrow("unauthorized");
    expect(store.has("p2p-session")).toBe(false);

    fetchMock
      .mockResolvedValueOnce(reply(201, { token: "fresh" }))
      .mockResolvedValueOnce(reply(200, []));
    await api("/groups");
    expect(fetchMock.mock.calls.at(-1)![1].headers.Authorization).toBe("Bearer fresh");
  });

  it("shares one registration between calls racing on first launch", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/device") ? reply(201, { token: "only" }) : reply(200, []),
    );

    await Promise.all([api("/groups"), api("/me"), api("/groups")]);

    expect(paths().filter((p) => p === "/api/auth/device")).toHaveLength(1);
  });

  it("treats 204 No Content as success", async () => {
    store.set("p2p-session", { token: "t1" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError("no body");
      },
    } as unknown as Response);

    await expect(api("/groups/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("surfaces API error codes", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(201, { token: "t1" }))
      .mockResolvedValueOnce(reply(429, { error: "too_many_requests" }));

    await expect(api("/groups/join", { method: "POST", body: { code: "x" } })).rejects.toThrow(
      "too_many_requests",
    );
    expect(store.has("p2p-session")).toBe(true);
  });
});
