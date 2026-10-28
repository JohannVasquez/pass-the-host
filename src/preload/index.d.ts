import { ElectronAPI } from "@electron-toolkit/preload";
import type { TokenRequest } from "ably";

// S3-compatible storage types
type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other" | "GoogleDrive";

interface S3ConfigType {
  provider?: S3Provider;
  endpoint: string;
  region?: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  drive_token?: string;
  profiles?: Partial<Record<S3Provider, Partial<Omit<S3ConfigType, "provider" | "profiles">>>>;
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
  getBucketSize: (config: S3ConfigType) => Promise<number>;
  getServerSize: (config: S3ConfigType, serverId: string) => Promise<number>;
  authorizeDrive: () => Promise<string>;
  cancelAuthorizeDrive: () => Promise<void>;
  shareDriveServer: (config: S3ConfigType, serverId: string, email: string) => Promise<void>;
}

interface AppConfigData {
  s3: {
    provider: S3Provider;
    endpoint: string;
    region: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
    drive_token?: string;
    profiles?: S3ConfigType["profiles"];
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
    cloud_sync_enabled: boolean;
  };
}

interface ConfigAPI {
  loadConfig: () => Promise<AppConfigData | null>;
  saveS3Config: (s3Config: S3ConfigType) => Promise<boolean>;
  saveCloudSyncEnabled: (enabled: boolean) => Promise<boolean>;
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
  readProperties: (serverId: string) => Promise<Record<string, string>>;
  writeProperties: (serverId: string, properties: Record<string, string>) => Promise<boolean>;
  /** "canceled" when the dialog is closed, "no-world" before the first start, "invalid" when no level.dat is found */
  exportWorld: (serverId: string) => Promise<"done" | "canceled" | "no-world">;
  importWorld: (serverId: string) => Promise<"done" | "canceled" | "invalid">;
  resetWorld: (serverId: string, levelNames: string[]) => Promise<"done">;
  readWhitelist: (serverId: string) => Promise<Array<{ uuid: string; name: string }>>;
  writeWhitelist: (serverId: string, entries: Array<{ uuid: string; name: string }>) => Promise<boolean>;
  lookupPlayer: (name: string, onlineMode: boolean) => Promise<{ uuid: string; name: string } | null>;
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
  onProcessExit: (
    callback: (payload: { serverId: string; code: number | null }) => void,
  ) => () => void;
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
    serverType: "vanilla" | "forge" | "neoforge",
    overwrite?: boolean,
    displayName?: string,
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
  listLocalServers: () => Promise<
    Array<{ id: string; name: string; version: string; type: "vanilla" | "forge" | "neoforge" | "unknown" }>
  >;
}

interface JavaAPI {
  ensureForMinecraft: (
    minecraftVersion: string,
  ) => Promise<{ success: boolean; javaPath?: string; version?: string; error?: string }>;
  getInstalledVersions: () => Promise<Array<{ version: number; path: string }>>;
  getRequiredVersion: (minecraftVersion: string) => Promise<number>;
  onProgress: (callback: (message: string) => void) => () => void;
}

interface NotificationAPI {
  show: (title: string, body: string) => Promise<void>;
}

interface P2PMember {
  id: string;
  name: string | null;
  isOwner: boolean;
  isYou: boolean;
}

interface P2PGroup {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
}

type TurnConfig =
  | { type: "cloudflare"; keyId: string; apiToken: string }
  | { type: "static"; urls: string[]; username: string; credential: string };

interface P2PAPI {
  listGroups: () => Promise<P2PGroup[]>;
  createGroup: (name: string) => Promise<P2PGroup>;
  joinGroup: (code: string) => Promise<P2PGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  rotateInviteCode: (groupId: string) => Promise<P2PGroup>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  deleteMyData: () => Promise<void>;
  listMembers: (groupId: string) => Promise<P2PMember[]>;
  setDisplayName: (name: string) => Promise<void>;
  getAblyToken: () => Promise<TokenRequest>;
  getTurnConfig: () => Promise<TurnConfig | null>;
  saveTurnConfig: (config: TurnConfig | null) => Promise<void>;
  getIceServers: () => Promise<{ iceServers: RTCIceServer[] }>;
  clientListen: (port: number) => Promise<number>;
  hostConnect: (connId: string, port: number) => void;
  tcpWrite: (connId: string, data: Uint8Array) => void;
  tcpEnd: (connId: string) => void;
  tcpPause: (connId: string) => void;
  tcpResume: (connId: string) => void;
  closeAll: () => void;
  onTcpOpen: (callback: (connId: string) => void) => () => void;
  onTcpData: (callback: (connId: string, data: Uint8Array<ArrayBuffer>) => void) => () => void;
  onTcpClose: (callback: (connId: string) => void) => () => void;
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
    notificationAPI: NotificationAPI;
    p2pAPI: P2PAPI;
  }
}

export type { P2PGroup, P2PMember, TurnConfig };
