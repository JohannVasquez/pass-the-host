/**
 * S3-Compatible Provider Types
 */
export type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

/**
 * S3-Compatible Storage Configuration
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
 * @deprecated Use S3Config instead
 */
export type R2Config = S3Config;

/**
 * Server Configuration
 */
export interface ServerConfig {
  server_path: string;
  java_path: string;
  server_jar: string;
  server_type: string;
  memory_min: string;
  memory_max: string;
  server_port: number;
}

/**
 * App Settings
 */
export interface AppSettings {
  owner_name: string | null;
  language: string;
}

/**
 * Application Configuration entity
 * Represents the complete application configuration from config.json
 */
export interface AppConfig {
  s3: S3Config;
  /** @deprecated Use s3 instead */
  r2?: R2Config;
  server: ServerConfig;
  app: AppSettings;
}

/**
 * Partial application configuration for updates
 */
export type PartialAppConfig = Partial<AppConfig>;
