export type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

export interface S3Config {
  provider?: S3Provider;
  endpoint?: string;
  region?: string;
  access_key?: string;
  secret_key?: string;
  bucket_name?: string;
}

export interface ServerConfig {
  server_path?: string;
  java_path?: string;
  server_jar?: string;
  server_type?: string;
  memory_min?: string;
  memory_max?: string;
  server_port?: number;
}

export interface AppSettings {
  owner_name?: string | null;
  language?: string;
}

export interface AppConfig {
  s3?: S3Config;
  server?: ServerConfig;
  app?: AppSettings;
}

export interface ConfigSaveResult {
  success: boolean;
  error?: string;
}
