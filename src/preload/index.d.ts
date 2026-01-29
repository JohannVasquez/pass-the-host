import { ElectronAPI } from "@electron-toolkit/preload";

// S3-compatible storage types
type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

interface S3ConfigType {
  provider?: S3Provider;
  endpoint: string;
  region?: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

interface RcloneAPI {
  checkInstallation: () => Promise<boolean>;
  installRclone: () => Promise<boolean>;
  testConnection: (config: S3ConfigType) => Promise<boolean>;
  listServers: (
    config: S3ConfigType,
  ) => Promise<Array<{ id: string; name: string; version: string; type: string }>>;
  onProgress: (callback: (message: string) => void) => () => void;
  onTransferProgress: (
    callback: (progress: { percent: number; transferred: string; total: string }) => void,
  ) => () => void;
  downloadServer: (config: S3ConfigType, serverId: string) => Promise<boolean>;
  uploadServer: (config: S3ConfigType, serverId: string) => Promise<boolean>;
}

interface AppConfigData {
  s3: {
    provider: S3Provider;
    endpoint: string;
    region: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  };
  server: {
    server_path: string;
    java_path: string;
    server_jar: string;
    server_type: string;
    memory_min: string;
    memory_max: string;
    server_port: number;
  };
  app: {
    owner_name: string | null;
    language: string;
  };
}

interface ConfigAPI {
  loadConfig: () => Promise<AppConfigData | null>;
  saveS3Config: (s3Config: S3ConfigType) => Promise<boolean>;
  saveUsername: (username: string) => Promise<boolean>;
  saveRamConfig: (minRam: number, maxRam: number) => Promise<boolean>;
  saveLanguage: (language: string) => Promise<boolean>;
}

interface SystemAPI {
  getTotalMemoryGB: () => Promise<number>;
  getNetworkInterfaces: () => Promise<Array<{ name: string; ip: string }>>;
}

interface ServerAPI {
  createLock: (serverId: string, username: string) => Promise<boolean>;
  readLock: (
    s3Config: S3ConfigType,
    serverId: string,
  ) => Promise<{ exists: boolean; username?: string; startedAt?: string; timestamp?: number }>;
  uploadLock: (config: S3ConfigType, serverId: string) => Promise<boolean>;
  deleteLock: (
    config: S3ConfigType,
    serverId: string,
  ) => Promise<{ success: boolean; existed: boolean }>;
  deleteLocalLock: (serverId: string) => Promise<{ success: boolean; existed: boolean }>;
  readPort: (serverId: string) => Promise<number>;
  writePort: (serverId: string, port: number) => Promise<boolean>;
  getLocalServerPath: (serverId: string) => Promise<string>;
  spawnServerProcess: (
    serverId: string,
    command: string,
    args: string[],
    workingDir: string,
  ) => Promise<boolean>;
  killServerProcess: (serverId: string) => Promise<void>;
  editForgeJvmArgs: (serverId: string, minRam: number, maxRam: number) => Promise<void>;
  readForgeJvmArgs: (serverId: string) => Promise<{ allArgs: string[] } | null>;
  onStdout: (callback: (data: string) => void) => () => void;
  sendCommand: (serverId: string, command: string) => Promise<boolean>;
  openServerFolder: (serverId: string) => Promise<boolean>;
  createSession: (serverId: string, username: string) => Promise<boolean>;
  updateSession: (serverId: string, username: string) => Promise<boolean>;
  uploadSession: (config: S3ConfigType, serverId: string) => Promise<boolean>;
  shouldDownload: (config: S3ConfigType, serverId: string) => Promise<boolean>;
  getStatistics: (serverId: string) => Promise<{
    totalPlaytime: number;
    sessionCount: number;
    sessions: Array<{
      username: string;
      startTime: string;
      startTimestamp: number;
      endTime?: string;
      endTimestamp?: number;
      duration?: number;
    }>;
  } | null>;
  createMinecraftServer: (
    serverName: string,
    version: string,
    serverType: "vanilla" | "forge",
    overwrite?: boolean,
  ) => Promise<{
    success: boolean;
    error?: string;
    errorCode?: "SERVER_EXISTS" | "JAVA_NOT_FOUND" | "NETWORK_ERROR" | "UNKNOWN";
  }>;
  onCreateProgress: (callback: (message: string) => void) => () => void;
  deleteFromS3: (
    config: S3ConfigType,
    serverId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteLocally: (serverId: string) => Promise<{ success: boolean; error?: string }>;
}

interface JavaAPI {
  ensureForMinecraft: (
    minecraftVersion: string,
  ) => Promise<{ success: boolean; javaPath?: string; version?: string; error?: string }>;
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
