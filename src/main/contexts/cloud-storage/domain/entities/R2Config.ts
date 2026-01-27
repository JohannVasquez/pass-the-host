export interface R2Config {
  endpoint: string;
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
