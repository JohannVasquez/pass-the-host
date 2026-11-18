import { describe, it, expect } from "vitest";
import { discordToGame, usesNewClickEvent } from "@main/contexts/discord-notifications/domain/discordToGame";

const parts = (cmd: string | null) => {
  expect(cmd?.startsWith("tellraw @a ")).toBe(true);
  return JSON.parse((cmd as string).slice("tellraw @a ".length)) as Record<string, never>[];
};
const visible = (cmd: string | null) => parts(cmd).map((p) => p.text).join("");

describe("discordToGame", () => {
  it("builds prefix, author and content", () => {
    const p = parts(discordToGame({ author: "Ever", content: "hola" }));
    expect(p.map((x) => x.text)).toEqual(["[Discord] ", "Ever", ": ", "hola"]);
    expect(p[0].color).toBe("blue");
  });

  it("shows replies", () => {
    expect(visible(discordToGame({ author: "Ever", replyTo: "Sam", content: "x" }))).toBe(
      "[Discord] Ever → Sam: x",
    );
  });

  it("cannot break out of the JSON or inject commands", () => {
    const cmd = discordToGame({
      author: 'a"}]',
      content: 'hi\\"}] ,{"text":"x"}\nsecond\r\nline §4red\u0007',
    });
    expect(cmd).not.toMatch(/[\r\n]/);
    const p = parts(cmd);
    expect(p.every((x) => typeof x === "object" && typeof x.text === "string")).toBe(true);
    expect(visible(cmd)).toBe('[Discord] a"}]: hi\\"}] ,{"text":"x"} second line 4red');
  });

  it("converts custom and unicode emoji", () => {
    expect(visible(discordToGame({ author: "a", content: "<:pepe:123> <a:wave:9> 😄" }))).toBe(
      "[Discord] a: :pepe: :wave: :smile:",
    );
  });

  it("makes links clickable and labels gif sites", () => {
    const p = parts(discordToGame({ author: "a", content: "see https://example.com/x, and https://tenor.com/v/1" }));
    const links = p.filter((x) => x.underlined);
    expect(links.map((x) => x.text)).toEqual(["https://example.com/x", "[GIF]"]);
    expect(links[0].click_event).toEqual({ action: "open_url", url: "https://example.com/x" });
    expect(links[0].color).toBe("aqua");
  });

  it("uses the legacy click key before 1.21.5", () => {
    const p = parts(discordToGame({ author: "a", content: "https://e.com/" }, { minecraftVersion: "1.21.4" }));
    const l = p.find((x) => x.underlined)!;
    expect(l.clickEvent).toEqual({ action: "open_url", value: "https://e.com/" });
    expect(l.click_event).toBeUndefined();
    expect(usesNewClickEvent("1.21.5")).toBe(true);
    expect(usesNewClickEvent("1.20.1")).toBe(false);
    expect(usesNewClickEvent("1.9")).toBe(false);
    expect(usesNewClickEvent("25w14a")).toBe(true);
    expect(usesNewClickEvent(undefined)).toBe(true);
  });

  it("labels attachments and stickers in the server language", () => {
    const cmd = discordToGame(
      {
        author: "a",
        content: "",
        attachments: [{ kind: "image", url: "https://cdn.discordapp.com/a.png" }, { kind: "file", url: "https://cdn.discordapp.com/b.zip" }],
        stickers: ["wave"],
      },
      { language: "es" },
    );
    expect(visible(cmd)).toBe("[Discord] a:  [imagen] [archivo] [sticker: wave]");
    expect(parts(cmd).find((x) => x.text === "[imagen]")!.click_event.url).toBe("https://cdn.discordapp.com/a.png");
  });

  it("caps visible text at 256 chars", () => {
    const text = visible(discordToGame({ author: "a", content: "x".repeat(1000) }));
    expect(text.length).toBe(256);
    expect(text.endsWith("…")).toBe(true);
  });

  it("returns null when there is nothing to show", () => {
    expect(discordToGame({ author: "a", content: "  \n " })).toBeNull();
    expect(discordToGame({ author: "a" })).toBeNull();
  });
});
