import { describe, expect, it } from "vitest";
import {
  findBundledJavaPath,
  getBundledJavaCandidates,
  getDefaultRelativeJavaPath,
  getJavaBinaryName,
  getRequiredJavaMajor,
  pickJavaMajor,
  hasBundledJavaBinary,
} from "@main/utils/javaRuntime";

describe("javaRuntime utilities", () => {
  it("returns the correct java binary name per platform", () => {
    expect(getJavaBinaryName("win32")).toBe("java.exe");
    expect(getJavaBinaryName("darwin")).toBe("java");
    expect(getJavaBinaryName("linux")).toBe("java");
  });

  it("prefers the standard bundled path when present", () => {
    const javaDir = "/tmp/java21";
    const expectedPath = `${javaDir}/bin/java`;

    const javaPath = findBundledJavaPath(javaDir, (filePath) => filePath === expectedPath, "linux");

    expect(javaPath).toBe(expectedPath);
  });

  it("resolves the macOS Contents/Home java binary", () => {
    const javaDir = "/tmp/java21";
    const expectedPath = `${javaDir}/Contents/Home/bin/java`;

    const javaPath = findBundledJavaPath(javaDir, (filePath) => filePath === expectedPath, "darwin");

    expect(javaPath).toBe(expectedPath);
    expect(hasBundledJavaBinary(javaDir, (filePath) => filePath === expectedPath, "darwin")).toBe(
      true,
    );
  });

  it("includes both standard and macOS bundle candidates", () => {
    const candidates = getBundledJavaCandidates("/tmp/java17", "darwin");

    expect(candidates).toEqual([
      "/tmp/java17/bin/java",
      "/tmp/java17/Contents/Home/bin/java",
    ]);
  });

  it("returns platform-specific default relative config paths", () => {
    expect(getDefaultRelativeJavaPath("win32")).toBe("./java_runtime/bin/java.exe");
    expect(getDefaultRelativeJavaPath("darwin")).toBe("./java_runtime/bin/java");
    expect(getDefaultRelativeJavaPath("linux")).toBe("./java_runtime/bin/java");
  });

  it("maps Minecraft versions to the Java major they need", () => {
    expect(getRequiredJavaMajor("1.7.10")).toBe(8);
    expect(getRequiredJavaMajor("1.12.2")).toBe(8);
    expect(getRequiredJavaMajor("1.16.5")).toBe(11);
    expect(getRequiredJavaMajor("1.18.2")).toBe(17);
    expect(getRequiredJavaMajor("1.21.1")).toBe(21);
    expect(getRequiredJavaMajor("26.1")).toBe(25);
  });

  it("lets Mojang's declared Java raise the table but never lower it", () => {
    // 1.17 declares 16 (no Apple Silicon build): the table's 17 wins
    expect(pickJavaMajor("1.17.1", 16)).toBe(17);
    expect(pickJavaMajor("1.16.5", 8)).toBe(11);
    expect(pickJavaMajor("1.21.1", 21)).toBe(21);
    // A future release needing a newer Java follows Mojang without an app update
    expect(pickJavaMajor("26.3", 29)).toBe(29);
    // Offline or unknown version: the table alone
    expect(pickJavaMajor("1.20.4", null)).toBe(21);
  });
});
