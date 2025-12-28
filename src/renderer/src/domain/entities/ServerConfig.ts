export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
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
