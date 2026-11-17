import { describe, it, expect } from "vitest";
import {
  LineBuffer,
  stripAnsi,
  parseServerLine,
  sanitizeMentions,
  truncate,
  isValidWebhookUrl,
  discordUsername,
} from "@main/contexts/discord-notifications/domain/serverLog";

describe("LineBuffer", () => {
  it("joins a line cut across chunks", () => {
    const b = new LineBuffer();
    expect(b.push("[01:00:00] [Server th")).toEqual([]);
    expect(b.push("read/INFO]: <Steve")).toEqual([]);
    expect(b.push("> hi\n")).toEqual(["[01:00:00] [Server thread/INFO]: <Steve> hi"]);
  });
  it("handles many lines, CRLF and flush", () => {
    const b = new LineBuffer();
    expect(b.push("a\r\nb\nc")).toEqual(["a", "b"]);
    expect(b.flush()).toEqual(["c"]);
    expect(b.flush()).toEqual([]);
  });
  it("caps a never-ending line", () => {
    const b = new LineBuffer();
    b.push("x".repeat(100_000));
    expect(b.flush()[0].length).toBe(16 * 1024);
  });
});

describe("parseServerLine", () => {
  const chat = (player: string, message: string) => ({ type: "chat", player, message });
  it.each([
    "[01:31:14] [Server thread/INFO]: <Steve> hi",
    "[01:31:14 INFO]: <Steve> hi",
    "[01:31:14] [Async Chat Thread - #0/INFO]: <Steve> hi",
    "[01:31:14] [Server thread/INFO] [minecraft/DedicatedServer]: <Steve> hi",
    "[17Nov2026 01:31:14.123] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: <Steve> hi",
    "[01:31:14] [Server thread/INFO]: [Not Secure] <Steve> hi",
    "  \x1b[0;37m[01:31:14] [Server thread/INFO]: <Steve> hi\x1b[m",
  ])("chat: %s", (line) => {
    expect(parseServerLine(line)).toEqual(chat("Steve", "hi"));
  });

  it.each([
    "[01:31:14] [Server thread/INFO]: [Server] hello",
    "[01:31:14] [Server thread/WARN]: Can't keep up! <foo> bar",
    "Some <html> text",
    "<Steve> hi",
    "\tat net.minecraft.Foo.bar(Foo.java:12)",
    "[01:31:14] [Server thread/INFO]: Starting minecraft server",
  ])("ignored: %s", (line) => {
    expect(parseServerLine(line)).toBeNull();
  });

  it("keeps a chat saying 'joined the game' as chat", () => {
    expect(
      parseServerLine("[01:31:14] [Server thread/INFO]: <Steve> Bob joined the game"),
    ).toEqual(chat("Steve", "Bob joined the game"));
  });

  it("parses started, joined, left", () => {
    expect(
      parseServerLine('[01:31:14] [Server thread/INFO]: Done (3.456s)! For help, type "help"'),
    ).toEqual({ type: "started" });
    expect(parseServerLine("[01:31:14] [Server thread/INFO]: Steve joined the game")).toEqual({
      type: "joined",
      player: "Steve",
    });
    expect(parseServerLine("[01:31:14 INFO]: Steve left the game")).toEqual({
      type: "left",
      player: "Steve",
    });
  });
});

describe("helpers", () => {
  it("stripAnsi", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });
  it("sanitizeMentions", () => {
    expect(sanitizeMentions("@everyone and @here")).not.toMatch(/@everyone|@here/);
    expect(sanitizeMentions("@Everyone")).toBe("@​Everyone");
  });
  it("truncate", () => {
    expect(truncate("a".repeat(3000)).length).toBe(2000);
    expect(truncate("a".repeat(3000)).endsWith("…")).toBe(true);
    expect(truncate("short")).toBe("short");
  });
  it("isValidWebhookUrl", () => {
    expect(isValidWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(true);
    expect(isValidWebhookUrl("https://discordapp.com/api/webhooks/123/abc")).toBe(true);
    expect(isValidWebhookUrl("https://canary.discord.com/api/webhooks/1/a_b-c")).toBe(true);
    expect(isValidWebhookUrl("http://discord.com/api/webhooks/123/abc")).toBe(false);
    expect(isValidWebhookUrl("https://example.com/api/webhooks/123/abc")).toBe(false);
    expect(isValidWebhookUrl("https://discord.com.evil.com/api/webhooks/1/a")).toBe(false);
    expect(isValidWebhookUrl("https://discord.com/api/other/1/a")).toBe(false);
    expect(isValidWebhookUrl("https://discord.com/api/webhooks/123")).toBe(false);
    expect(isValidWebhookUrl("nope")).toBe(false);
    expect(isValidWebhookUrl("")).toBe(false);
  });
  it("discordUsername", () => {
    expect(discordUsername("Steve")).toBe("Steve");
    expect(discordUsername("xDiscordx")).toBeNull();
    expect(discordUsername("Clyde")).toBeNull();
    expect(discordUsername("here")).toBeNull();
    expect(discordUsername("Everyone")).toBeNull();
    expect(discordUsername("hereford")).toBe("hereford");
  });
});
