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
}

interface ConfigAPI {
  loadConfig: () => Promise<any>;
  saveR2Config: (r2Config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  }) => Promise<boolean>;
}

interface SystemAPI {
  getTotalMemoryGB: () => Promise<number>;
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
