import { describe, it, expect } from "vitest";
import {
  DISCORD_LANGUAGES,
  discordMessages,
  resolveDiscordLanguage,
} from "@main/contexts/discord-notifications/domain/messages";

describe("discord messages", () => {
  it.each(DISCORD_LANGUAGES)("%s has every notice with names in bold", (lang) => {
    const m = discordMessages(lang);
    for (const text of [
      m.online("Srv"),
      m.stopped("Srv"),
      m.crashed("Srv", 3),
      m.joined("Ann", "Srv"),
      m.left("Ann", "Srv"),
    ]) {
      expect(text).toContain("**Srv**");
    }
    expect(m.crashed("Srv", 3)).toContain("3");
    expect(m.joined("Ann", "Srv")).toContain("**Ann**");
    expect(m.left("Ann", "Srv")).toContain("**Ann**");
    expect(m.test().length).toBeGreaterThan(0);
  });

  it("resolves the language with an English fallback", () => {
    expect(resolveDiscordLanguage(undefined)).toBe("en");
    expect(resolveDiscordLanguage("xx")).toBe("en");
    expect(resolveDiscordLanguage("pt")).toBe("en");
    expect(resolveDiscordLanguage("pt-BR")).toBe("pt-BR");
  });
});
