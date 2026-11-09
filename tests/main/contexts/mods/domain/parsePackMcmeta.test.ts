import { describe, it, expect } from "vitest";
import { parsePackMcmeta } from "@main/contexts/mods/domain/parsePackMcmeta";

describe("parsePackMcmeta", () => {
  it("reads a string description and the pack format", () => {
    expect(
      parsePackMcmeta(JSON.stringify({ pack: { pack_format: 48, description: "Hi" } })),
    ).toEqual({ description: "Hi", packFormat: 48 });
  });

  it("flattens component arrays with extra and strips § codes", () => {
    const raw = JSON.stringify({
      pack: {
        description: [{ text: "§aGreen ", extra: [{ text: "child" }] }, "§lBold"],
      },
    });
    expect(parsePackMcmeta(raw)).toEqual({ description: "Green childBold" });
  });

  it("returns null for invalid JSON or a missing pack", () => {
    expect(parsePackMcmeta("{nope")).toBeNull();
    expect(parsePackMcmeta(JSON.stringify({ other: 1 }))).toBeNull();
  });
});
