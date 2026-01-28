export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  access_key?: string;
  secret_key?: string;
  bucket_name?: string;
  region?: string;
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
  r2?: R2Config;
  server?: ServerConfig;
  app?: AppSettings;
}

export interface ConfigSaveResult {
  success: boolean;
  error?: string;
}
