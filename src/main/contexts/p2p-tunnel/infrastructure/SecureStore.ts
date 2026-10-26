import { app, safeStorage } from "electron";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

// Small JSON files in userData, encrypted with the OS keychain when it's available
const fileFor = (name: string): string => join(app.getPath("userData"), `${name}.bin`);

export function readSecureJson<T>(name: string): T | null {
  if (!existsSync(fileFor(name))) return null;
  try {
    const raw = readFileSync(fileFor(name));
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString();
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function writeSecureJson(name: string, value: unknown): void {
  const json = JSON.stringify(value);
  writeFileSync(
    fileFor(name),
    safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : json,
  );
}

export function removeSecureJson(name: string): void {
  rmSync(fileFor(name), { force: true });
}
