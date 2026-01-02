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
  onProgress: (callback: (message: string) => void) => () => void;
  onTransferProgress: (
    callback: (progress: { percent: number; transferred: string; total: string }) => void
  ) => () => void;
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
  saveRamConfig: (minRam: number, maxRam: number) => Promise<boolean>;
}

interface SystemAPI {
  getTotalMemoryGB: () => Promise<number>;
  getNetworkInterfaces: () => Promise<Array<{ name: string; ip: string }>>;
}

interface ServerAPI {
  createLock: (serverId: string, username: string) => Promise<boolean>;
  readLock: (
    r2Config: any,
    serverId: string
  ) => Promise<{ exists: boolean; username?: string; startedAt?: string; timestamp?: number }>;
  uploadLock: (
    config: {
      endpoint: string;
      access_key: string;
      secret_key: string;
      bucket_name: string;
    },
    serverId: string
  ) => Promise<boolean>;
  deleteLock: (
    config: {
      endpoint: string;
      access_key: string;
      secret_key: string;
      bucket_name: string;
    },
    serverId: string
  ) => Promise<{ success: boolean; existed: boolean }>;
  deleteLocalLock: (serverId: string) => Promise<{ success: boolean; existed: boolean }>;
  readPort: (serverId: string) => Promise<number>;
  writePort: (serverId: string, port: number) => Promise<boolean>;
  getLocalServerPath: (serverId: string) => Promise<string>;
  spawnServerProcess: (
    serverId: string,
    command: string,
    args: string[],
    workingDir: string
  ) => Promise<any>;
  killServerProcess: (serverId: string) => Promise<void>;
  editForgeJvmArgs: (serverId: string, minRam: number, maxRam: number) => Promise<void>;
  onStdout: (callback: (data: string) => void) => () => void;
  openServerFolder: (serverId: string) => Promise<boolean>;
}

interface JavaAPI {
  ensureForMinecraft: (
    minecraftVersion: string
  ) => Promise<{ success: boolean; javaPath: string; javaVersion: number }>;
  getInstalledVersions: () => Promise<Array<{ version: number; path: string }>>;
  getRequiredVersion: (minecraftVersion: string) => Promise<number>;
  onProgress: (callback: (message: string) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
    rclone: RcloneAPI;
    configAPI: ConfigAPI;
    systemAPI: SystemAPI;
    serverAPI: ServerAPI;
    javaAPI: JavaAPI;
  }
}

export {};
