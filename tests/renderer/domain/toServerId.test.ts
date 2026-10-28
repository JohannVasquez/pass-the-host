import { describe, expect, it } from "vitest";
import { toServerId } from "@renderer/domain/entities/Server";

describe("toServerId", () => {
  it("turns any name into a kebab-case id", () => {
    expect(toServerId("Survival de los Pibes")).toBe("survival-de-los-pibes");
    expect(toServerId("  Mundo Épico!! 2.0 ")).toBe("mundo-epico-2-0");
    expect(toServerId("my_old-server")).toBe("my-old-server");
    expect(toServerId("Сервер друзей")).toBe("сервер-друзеи");
  });

  it("never returns an empty or reserved folder name", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(toServerId("🎮🎮🎮")).toMatch(uuid);
    expect(toServerId("★ ★ ★")).toMatch(uuid);
    expect(toServerId("🎮🎮🎮")).not.toBe(toServerId("🎮🎮🎮"));
    expect(toServerId("CON")).toBe("con-server");
    expect(toServerId("a".repeat(80) + " b")).toHaveLength(64);
  });
});
