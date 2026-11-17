import { describe, it, expect, vi } from "vitest";

vi.mock("@shared/infrastructure/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  RelayServerOutputUseCase,
  SendDiscordTestMessageUseCase,
} from "@main/contexts/discord-notifications/application/use-cases";

const URL_ = "https://discord.com/api/webhooks/1/tok";
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(settings: object | undefined) {
  const webhooks = { enqueue: vi.fn(), sendNow: vi.fn() };
  const load = vi.fn().mockResolvedValue(settings);
  const uc = new RelayServerOutputUseCase(webhooks, load, (id) => `Server ${id}`);
  return { webhooks, load, uc };
}
const chatLine = "[01:00:00] [Server thread/INFO]: <Steve> hello @everyone\n";

describe("RelayServerOutputUseCase", () => {
  it("does nothing when webhook is empty", async () => {
    const { webhooks, uc } = setup({ webhook_url: "" });
    uc.onOutput("s1", "stdout", chatLine);
    await flush();
    expect(webhooks.enqueue).not.toHaveBeenCalled();
  });

  it("relays chat with defaults and neutralises mentions", async () => {
    const { webhooks, load, uc } = setup({ webhook_url: URL_ });
    uc.onOutput("s1", "stdout", chatLine);
    await flush();
    const [url, payload] = webhooks.enqueue.mock.calls[0];
    expect(url).toBe(URL_);
    expect(load).toHaveBeenCalledWith("s1");
    expect(payload.username).toBe("Steve");
    expect(payload.avatar_url).toBe("https://mc-heads.net/avatar/Steve/128");
    expect(payload.content).not.toContain("@everyone");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it("uses fallback name for reserved usernames", async () => {
    const { webhooks, uc } = setup({ webhook_url: URL_ });
    uc.onOutput("s1", "stdout", "[01:00:00 INFO]: <Clyde> yo\n");
    await flush();
    expect(webhooks.enqueue.mock.calls[0][1]).toMatchObject({
      username: "Pass the host",
      content: "**Clyde**: yo",
      // Still the player's own head, only the name falls back
      avatar_url: "https://mc-heads.net/avatar/Clyde/128",
    });
  });

  it("joins are off by default, on when enabled", async () => {
    const line = "[01:00:00] [Server thread/INFO]: Steve joined the game\n";
    const a = setup({ webhook_url: URL_ });
    a.uc.onOutput("s1", "stdout", line);
    await flush();
    expect(a.webhooks.enqueue).not.toHaveBeenCalled();
    const b = setup({ webhook_url: URL_, notify_joins: true });
    b.uc.onOutput("s1", "stdout", line);
    await flush();
    expect(b.webhooks.enqueue.mock.calls[0][1].content).toContain("**Steve** joined");
  });

  it("sends a stopped notice on exit (unexpected on non-zero code)", async () => {
    const a = setup({ webhook_url: URL_ });
    a.uc.onExit("s1", 0);
    await flush();
    expect(a.webhooks.enqueue.mock.calls[0][1].content).toContain("stopped");
    expect(a.webhooks.enqueue.mock.calls[0][1].avatar_url).toBe(
      "https://media.jvdev.cl/icon/discord-avatar.png",
    );
    const b = setup({ webhook_url: URL_ });
    b.uc.onExit("s1", 1);
    await flush();
    expect(b.webhooks.enqueue.mock.calls[0][1].content).toContain("exit code 1");
  });

  it("does not load settings for non-event lines", async () => {
    const { load, uc } = setup({ webhook_url: URL_ });
    uc.onOutput("s1", "stderr", "[01:00:00] [Server thread/INFO]: Preparing level\n");
    uc.onOutput("s1", "stdout", "random <b> text\n");
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it("never throws when settings fail to load", async () => {
    const webhooks = { enqueue: vi.fn(), sendNow: vi.fn() };
    const uc = new RelayServerOutputUseCase(
      webhooks,
      () => Promise.reject(new Error("x")),
      (id) => id,
    );
    expect(() => uc.onOutput("s1", "stdout", chatLine)).not.toThrow();
    await flush();
  });
});

describe("SendDiscordTestMessageUseCase", () => {
  it("validates and reports failures without the URL", async () => {
    const sendNow = vi.fn().mockRejectedValue(new Error("Discord responded with HTTP 404"));
    const uc = new SendDiscordTestMessageUseCase({ enqueue: vi.fn(), sendNow });
    expect(await uc.execute("http://x")).toEqual({ ok: false, error: "invalid_url" });
    expect(await uc.execute(URL_)).toEqual({
      ok: false,
      error: "failed",
      detail: "Discord responded with HTTP 404",
    });
    sendNow.mockResolvedValue(undefined);
    expect(await uc.execute(URL_)).toEqual({ ok: true });
  });
});
