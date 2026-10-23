export type S3Provider =
  | "AWS"
  | "Cloudflare"
  | "MinIO"
  | "Backblaze"
  | "DigitalOcean"
  | "Other"
  | "GoogleDrive";

export interface S3Config {
  provider: S3Provider;
  endpoint: string;
  region: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  /** OAuth token JSON from `rclone authorize drive` (GoogleDrive provider only). */
  drive_token?: string;
}

/** Display name of each provider, shown in the provider picker and in logs. */
export const PROVIDER_LABELS: Record<S3Provider, string> = {
  AWS: "Amazon S3",
  Cloudflare: "Cloudflare R2",
  MinIO: "MinIO",
  Backblaze: "Backblaze B2",
  DigitalOcean: "DigitalOcean Spaces",
  Other: "S3",
  GoogleDrive: "Google Drive",
};

/** @deprecated Use S3Config instead */
export type R2Config = S3Config;

export interface RamConfig {
  min: number;
  max: number;
}

export interface NetworkInterface {
  name: string;
  ip: string;
}

export interface ServerConfig {
  s3Config: S3Config;
  ramConfig: RamConfig;
  selectedIp: string | null;
  availableIps: NetworkInterface[];
}
