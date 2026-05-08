import { describe, expect, it } from "vitest";
import {
  findBundledJavaPath,
  getBundledJavaCandidates,
  getDefaultRelativeJavaPath,
  getJavaBinaryName,
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
});
