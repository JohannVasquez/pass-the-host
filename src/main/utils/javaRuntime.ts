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
