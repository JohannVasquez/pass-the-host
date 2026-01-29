/**
 * S3-Compatible Provider Types
 */
export type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

/**
 * S3-Compatible Storage Configuration entity
 * Represents S3-compatible storage credentials and settings
 * Supports: AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces
 */
export interface S3Config {
  provider?: S3Provider;
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  region?: string;
}

/**
 * Validates if S3 configuration is complete and valid
 */
export function isS3ConfigValid(config: Partial<S3Config>): config is S3Config {
  return !!(config.endpoint && config.access_key && config.secret_key && config.bucket_name);
}
