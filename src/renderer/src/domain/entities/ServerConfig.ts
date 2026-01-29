export type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

export interface S3Config {
  provider: S3Provider;
  endpoint: string;
  region: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

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
