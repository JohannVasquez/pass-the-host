import { describe, expect, it } from "vitest";
import type { S3Config } from "@main/contexts/app-configuration/domain/entities";
import {
  DEFAULT_STORAGE,
  isUnconfiguredStorage,
  saveStorageProfile,
  withStorageProfiles,
} from "@main/contexts/app-configuration/domain/utils/storageProfiles";

const r2Fields = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  region: "auto",
  access_key: "r2-key",
  secret_key: "r2-secret",
  bucket_name: "pass-the-host",
};

describe("withStorageProfiles", () => {
  it("splits a pre-profiles Drive config into a Drive and a guessed S3 profile", () => {
    const legacy: S3Config = { provider: "GoogleDrive", ...r2Fields, drive_token: "token" };

    const migrated = withStorageProfiles(legacy);

    expect(migrated.profiles?.GoogleDrive).toEqual({ drive_token: "token" });
    expect(migrated.profiles?.Cloudflare).toMatchObject(r2Fields);
    expect(migrated.profiles?.Cloudflare?.drive_token).toBeUndefined();
  });

  it("stores the S3 fields under the active S3 provider", () => {
    const migrated = withStorageProfiles({ provider: "Backblaze", ...r2Fields });

    expect(Object.keys(migrated.profiles ?? {})).toEqual(["Backblaze"]);
  });

  it("leaves configs that already have profiles untouched", () => {
    const config: S3Config = { provider: "AWS", profiles: {} };

    expect(withStorageProfiles(config)).toBe(config);
  });
});

describe("saveStorageProfile", () => {
  it("saves the active provider without overwriting the others", () => {
    const saved: S3Config = {
      provider: "GoogleDrive",
      drive_token: "token",
      profiles: { GoogleDrive: { drive_token: "token" }, Cloudflare: r2Fields },
    };

    const next = saveStorageProfile(saved, {
      provider: "Backblaze",
      endpoint: "https://s3.us-west-000.backblazeb2.com",
      access_key: "b2-key",
      secret_key: "b2-secret",
      bucket_name: "b2-bucket",
      drive_token: undefined,
    });

    expect(next.provider).toBe("Backblaze");
    expect(next.access_key).toBe("b2-key");
    expect(next.profiles?.Backblaze?.access_key).toBe("b2-key");
    expect(next.profiles?.Cloudflare).toEqual(r2Fields);
    expect(next.profiles?.GoogleDrive).toEqual({ drive_token: "token" });
    expect(JSON.parse(JSON.stringify(next)).drive_token).toBeUndefined();
  });

  it("ignores profiles sent with the active config", () => {
    const saved: S3Config = {
      provider: "Cloudflare",
      ...r2Fields,
      profiles: { Cloudflare: r2Fields },
    };

    const next = saveStorageProfile(saved, {
      provider: "GoogleDrive",
      drive_token: "new-token",
      profiles: {},
    });

    expect(next.profiles?.Cloudflare).toEqual(r2Fields);
    expect(next.profiles?.GoogleDrive?.drive_token).toBe("new-token");
  });
});

describe("default storage", () => {
  it("is Google Drive", () => {
    expect(DEFAULT_STORAGE.provider).toBe("GoogleDrive");
  });

  it("treats the blank Cloudflare placeholder of older installs as unconfigured", () => {
    const placeholder: S3Config = {
      provider: "Cloudflare",
      endpoint: "",
      region: "auto",
      access_key: "",
      secret_key: "",
      bucket_name: "",
    };
    expect(isUnconfiguredStorage(placeholder)).toBe(true);
    expect(isUnconfiguredStorage({})).toBe(true);
  });

  it("keeps any storage the user set up", () => {
    expect(isUnconfiguredStorage({ provider: "Cloudflare", ...r2Fields })).toBe(false);
    expect(isUnconfiguredStorage({ provider: "GoogleDrive", drive_token: "token" })).toBe(false);
  });

  it("keeps a provider the user picked and saved, even with empty fields", () => {
    const saved = saveStorageProfile(
      {},
      {
        provider: "AWS",
        endpoint: "",
        region: "",
        access_key: "",
        secret_key: "",
        bucket_name: "",
      },
    );
    expect(isUnconfiguredStorage(saved)).toBe(false);
    expect(saved.provider).toBe("AWS");
  });
});
