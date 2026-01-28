/**
 * R2 Configuration
 */
export interface R2Config {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  region?: string;
}

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
  r2: R2Config;
  server: ServerConfig;
  app: AppSettings;
}

/**
 * Partial application configuration for updates
 */
export type PartialAppConfig = Partial<AppConfig>;
