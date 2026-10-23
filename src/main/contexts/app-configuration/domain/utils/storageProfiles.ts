import type {
  S3Config,
  S3Provider,
  StorageProfile,
} from "@main/contexts/app-configuration/domain/entities";

/** The provider-specific part of a config, saved per provider so switching doesn't overwrite it. */
export function toStorageProfile(config: S3Config): StorageProfile {
  return {
    endpoint: config.endpoint,
    region: config.region,
    access_key: config.access_key,
    secret_key: config.secret_key,
    bucket_name: config.bucket_name,
    drive_token: config.drive_token,
  };
}

// Configs from before profiles only kept the active provider, and with Google Drive active the
// S3 fields still held whichever S3 provider was used last: tell it apart by its endpoint.
function guessS3Provider(endpoint = ""): S3Provider {
  if (endpoint.includes("r2.cloudflarestorage.com")) return "Cloudflare";
  if (endpoint.includes("amazonaws.com")) return "AWS";
  if (endpoint.includes("backblazeb2.com")) return "Backblaze";
  if (endpoint.includes("digitaloceanspaces.com")) return "DigitalOcean";
  if (/localhost|127\.0\.0\.1/.test(endpoint)) return "MinIO";
  return "Other";
}

/** Adds `profiles` to a config saved before they existed. */
export function withStorageProfiles(config: S3Config): S3Config {
  if (config.profiles || !config.provider) {
    return config;
  }

  const { drive_token, ...s3Fields } = toStorageProfile(config);
  const profiles: S3Config["profiles"] = {};

  if (drive_token) {
    profiles.GoogleDrive = { drive_token };
  }
  if (s3Fields.access_key || s3Fields.endpoint) {
    const s3Provider =
      config.provider === "GoogleDrive" ? guessS3Provider(s3Fields.endpoint) : config.provider;
    profiles[s3Provider] = s3Fields;
  }

  return { ...config, profiles };
}

/**
 * Makes `active` the current config and stores it as its provider's profile, keeping every
 * other provider's profile. Profiles sent by the renderer are ignored: the file is the source.
 */
export function saveStorageProfile(saved: S3Config, active: S3Config): S3Config {
  const base = withStorageProfiles(saved);
  const { profiles: _ignored, ...activeFields } = active;
  const profiles = { ...base.profiles };

  if (activeFields.provider) {
    profiles[activeFields.provider] = toStorageProfile(activeFields);
  }

  return { ...base, ...activeFields, profiles };
}
