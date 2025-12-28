export interface R2Config {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

export interface RamConfig {
  min: number;
  max: number;
}

export interface NetworkInterface {
  name: string;
  ip: string;
}

export interface ServerConfig {
  r2Config: R2Config;
  ramConfig: RamConfig;
  selectedIp: string | null;
  availableIps: NetworkInterface[];
}
