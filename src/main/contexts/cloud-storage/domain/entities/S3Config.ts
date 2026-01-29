export type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

export interface S3Config {
  provider: S3Provider;
  endpoint: string;
  region: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  version: string;
  type: string;
}

export interface TransferProgress {
  percent: number;
  transferred: string;
  total: string;
}
