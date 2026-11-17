import { describe, it, expect, vi } from "vitest";

vi.mock("@shared/infrastructure/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "@shared/infrastructure/logger";
import { DiscordWebhookRepository } from "@main/contexts/discord-notifications/infrastructure/repositories";

const URL_ = "https://discord.com/api/webhooks/1/secret-token";
const payload = { content: "hi", allowed_mentions: { parse: [] as [] } };
const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe("DiscordWebhookRepository", () => {
  it("retries on 429 after retry_after and then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(res(429, { retry_after: 1.5 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const repo = new DiscordWebhookRepository(fetchFn as never, sleep);
    await repo.sendNow(URL_, payload);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1500);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(fetchFn.mock.calls[0][1].headers["content-type"]).toBe("application/json");
  });

  it("gives up after 3 retries", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => res(429, { retry_after: 1 }));
    const repo = new DiscordWebhookRepository(fetchFn as never, vi.fn().mockResolvedValue(0));
    await expect(repo.sendNow(URL_, payload)).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("enqueue never throws on network error and does not log the URL", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error(`boom ${URL_}`));
    const repo = new DiscordWebhookRepository(fetchFn as never, vi.fn());
    expect(() => repo.enqueue(URL_, payload)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logged).not.toContain("secret-token");
  });

  it("sendNow error message does not contain the URL", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(404));
    const repo = new DiscordWebhookRepository(fetchFn as never, vi.fn());
    await expect(repo.sendNow(URL_, payload)).rejects.toThrow(/404/);
  });

  it("serializes requests", async () => {
    let release!: () => void;
    const first = new Promise<Response>((r) => {
      release = () => r(new Response(null, { status: 204 }));
    });
    const fetchFn = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const repo = new DiscordWebhookRepository(fetchFn as never, vi.fn());
    const a = repo.sendNow(URL_, payload);
    const b = repo.sendNow(URL_, payload);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([a, b]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
