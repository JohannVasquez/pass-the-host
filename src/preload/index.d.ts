import { ElectronAPI } from "@electron-toolkit/preload";

interface RcloneAPI {
  checkInstallation: () => Promise<boolean>;
  installRclone: () => Promise<boolean>;
  testR2Connection: (config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  }) => Promise<boolean>;
  listServers: (config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  }) => Promise<Array<{ id: string; name: string; version: string; type: string }>>;
  downloadServer: (
    config: {
      endpoint: string;
      access_key: string;
      secret_key: string;
      bucket_name: string;
    },
    serverId: string
  ) => Promise<boolean>;
  uploadServer: (
    config: {
      endpoint: string;
      access_key: string;
      secret_key: string;
      bucket_name: string;
    },
    serverId: string
  ) => Promise<boolean>;
}

interface ConfigAPI {
  loadConfig: () => Promise<any>;
  saveR2Config: (r2Config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  }) => Promise<boolean>;
  saveUsername: (username: string) => Promise<boolean>;
}

interface SystemAPI {
  getTotalMemoryGB: () => Promise<number>;
  getNetworkInterfaces: () => Promise<Array<{ name: string; ip: string }>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    rclone: RcloneAPI;
    configAPI: ConfigAPI;
    systemAPI: SystemAPI;
  }
}

export {};
