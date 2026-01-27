/**
 * R2 Configuration entity
 * Represents Cloudflare R2 storage credentials and settings
 */
export interface R2Config {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  region: string;
}

/**
 * Validates if R2 configuration is complete and valid
 */
export function isR2ConfigValid(config: Partial<R2Config>): config is R2Config {
  return !!(
    config.endpoint &&
    config.access_key &&
    config.secret_key &&
    config.bucket_name &&
    config.region
  );
}
