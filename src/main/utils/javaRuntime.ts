import * as path from "path";

export function getJavaBinaryName(platform = process.platform): string {
  return platform === "win32" ? "java.exe" : "java";
}

export function getBundledJavaCandidates(
  javaDir: string,
  platform = process.platform,
): string[] {
  const javaBinary = getJavaBinaryName(platform);

  return [
    path.join(javaDir, "bin", javaBinary),
    path.join(javaDir, "Contents", "Home", "bin", javaBinary),
  ];
}

export function findBundledJavaPath(
  javaDir: string,
  existsSync: (filePath: string) => boolean,
  platform = process.platform,
): string {
  const candidates = getBundledJavaCandidates(javaDir, platform);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function hasBundledJavaBinary(
  javaDir: string,
  existsSync: (filePath: string) => boolean,
  platform = process.platform,
): boolean {
  return getBundledJavaCandidates(javaDir, platform).some((candidate) => existsSync(candidate));
}

export function getDefaultRelativeJavaPath(platform = process.platform): string {
  return platform === "win32"
    ? "./java_runtime/bin/java.exe"
    : "./java_runtime/bin/java";
}

/** Java major version a Minecraft version needs; 1.7.10-1.12.2 must stay on 8 (old Forge breaks on 11). */
export function getRequiredJavaMajor(minecraftVersion: string): number {
  const [major, minor] = minecraftVersion.split(".").map((part) => parseInt(part));
  if (Number.isNaN(major)) return 21;
  // Year-based versions (26.1+)
  if (major >= 26) return 25;
  if (major > 1 || minor >= 19) return 21;
  if (minor >= 17) return 17;
  if (minor >= 13) return 11;
  if (minor >= 7) return 8;
  // Unknown / pre-1.7 versions keep the previous default
  return 21;
}
