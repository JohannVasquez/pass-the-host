import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type { TokenRequest } from "ably";

// S3 provider types
type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other" | "GoogleDrive";

interface S3ConfigType {
  provider: S3Provider;
  endpoint: string;
  region: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  drive_token?: string;
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

const api = {};

const rcloneAPI = {
  checkInstallation: (): Promise<boolean> => ipcRenderer.invoke("rclone:check-installation"),
  installRclone: (): Promise<boolean> => ipcRenderer.invoke("rclone:install"),
  testConnection: (config: S3ConfigType): Promise<boolean> =>
    ipcRenderer.invoke("rclone:test-s3-connection", config),
  listServers: (
    config: S3ConfigType,
  ): Promise<Array<{ id: string; name: string; version: string; type: string }>> =>
    ipcRenderer.invoke("rclone:list-servers", config),
  downloadServer: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("rclone:download-server", config, serverId),
  uploadServer: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("rclone:upload-server", config, serverId),
  getBucketSize: (config: S3ConfigType): Promise<number> =>
    ipcRenderer.invoke("cloud-storage:get-bucket-size", config),
  getServerSize: (config: S3ConfigType, serverId: string): Promise<number> =>
    ipcRenderer.invoke("cloud-storage:get-server-size", config, serverId),
  authorizeDrive: (): Promise<string> => ipcRenderer.invoke("rclone:authorize-drive"),
  cancelAuthorizeDrive: (): Promise<void> => ipcRenderer.invoke("rclone:cancel-authorize-drive"),
  shareDriveServer: (config: S3ConfigType, serverId: string, email: string): Promise<void> =>
    ipcRenderer.invoke("rclone:share-drive-server", config, serverId, email),
  onProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
      callback(message);
    ipcRenderer.on("rclone:progress", listener);
    return () => ipcRenderer.removeListener("rclone:progress", listener);
  },
  onTransferProgress: (
    callback: (progress: { percent: number; transferred: string; total: string }) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: { percent: number; transferred: string; total: string },
    ): void => callback(progress);
    ipcRenderer.on("rclone:transfer-progress", listener);
    return () => ipcRenderer.removeListener("rclone:transfer-progress", listener);
  },
};

interface AppConfigData {
  s3: {
    provider: S3Provider;
    endpoint: string;
    region: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
    drive_token?: string;
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

const configAPI = {
  loadConfig: (): Promise<AppConfigData | null> => ipcRenderer.invoke("config:load"),
  saveS3Config: async (s3Config: S3ConfigType): Promise<boolean> => {
    const result = await ipcRenderer.invoke("config:save-s3", s3Config);
    return result.success === true;
  },
  saveCloudSyncEnabled: async (enabled: boolean): Promise<boolean> => {
    const result = await ipcRenderer.invoke("config:save-cloud-sync-enabled", enabled);
    return result.success === true;
  },
  saveUsername: async (username: string): Promise<boolean> => {
    const result = await ipcRenderer.invoke("config:save-username", username);
    return result.success === true;
  },
  saveRamConfig: async (minRam: number, maxRam: number): Promise<boolean> => {
    const result = await ipcRenderer.invoke("config:save-ram", minRam, maxRam);
    return result.success === true;
  },
  saveLanguage: async (language: string): Promise<boolean> => {
    const result = await ipcRenderer.invoke("config:save-language", language);
    return result.success === true;
  },
};

interface ServerStatistics {
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
}

const systemAPI = {
  getTotalMemoryGB: (): Promise<number> => ipcRenderer.invoke("system:get-total-memory"),
  getNetworkInterfaces: (): Promise<Array<{ name: string; ip: string }>> =>
    ipcRenderer.invoke("system:get-network-interfaces"),
};

const serverAPI = {
  createLock: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:create-lock", serverId, username),
  readLock: (
    s3Config: S3ConfigType,
    serverId: string,
  ): Promise<{ exists: boolean; username?: string; startedAt?: string; timestamp?: number }> => {
    return ipcRenderer.invoke("server:read-server-lock", s3Config, serverId);
  },
  uploadLock: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:upload-lock", config, serverId),
  deleteLock: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:delete-lock", config, serverId),
  deleteLocalLock: (serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:delete-local-lock", serverId),
  readPort: (serverId: string): Promise<number> => ipcRenderer.invoke("server:read-port", serverId),
  writePort: (serverId: string, port: number): Promise<boolean> =>
    ipcRenderer.invoke("server:write-port", serverId, port),
  readProperties: (serverId: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke("server:read-properties", serverId),
  writeProperties: (serverId: string, properties: Record<string, string>): Promise<boolean> =>
    ipcRenderer.invoke("server:write-properties", serverId, properties),
  readWhitelist: (serverId: string): Promise<Array<{ uuid: string; name: string }>> =>
    ipcRenderer.invoke("server:read-whitelist", serverId),
  writeWhitelist: (
    serverId: string,
    entries: Array<{ uuid: string; name: string }>,
  ): Promise<boolean> => ipcRenderer.invoke("server:write-whitelist", serverId, entries),
  lookupPlayer: (name: string, onlineMode: boolean): Promise<{ uuid: string; name: string } | null> =>
    ipcRenderer.invoke("server:lookup-player", name, onlineMode),
  getLocalServerPath: (serverId: string): Promise<string> =>
    ipcRenderer.invoke("server:get-local-server-path", serverId),
  spawnServerProcess: (
    serverId: string,
    command: string,
    args: string[],
    workingDir: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke("server:spawn-server-process", serverId, command, args, workingDir),
  killServerProcess: (serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:kill-server-process", serverId),
  editForgeJvmArgs: (serverId: string, minRam: number, maxRam: number): Promise<boolean> =>
    ipcRenderer.invoke("server:edit-forge-jvm-args", serverId, minRam, maxRam),
  readForgeJvmArgs: (serverId: string): Promise<{ allArgs: string[] } | null> =>
    ipcRenderer.invoke("server:read-forge-jvm-args", serverId),
  onStdout: (callback: (data: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: string): void => callback(data);
    ipcRenderer.on("server:stdout", listener);
    return () => ipcRenderer.removeListener("server:stdout", listener);
  },
  onProcessExit: (
    callback: (payload: { serverId: string; code: number | null }) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { serverId: string; code: number | null },
    ): void => callback(payload);
    ipcRenderer.on("server:process-exit", listener);
    return () => ipcRenderer.removeListener("server:process-exit", listener);
  },
  sendCommand: (serverId: string, command: string): Promise<boolean> =>
    ipcRenderer.invoke("server:send-command", serverId, command),
  openServerFolder: (serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:openFolder", serverId),
  createSession: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:create-session", serverId, username),
  updateSession: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:update-session", serverId, username),
  uploadSession: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:upload-session", config, serverId),
  shouldDownload: (config: S3ConfigType, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:should-download", config, serverId),
  getStatistics: (serverId: string): Promise<ServerStatistics | null> =>
    ipcRenderer.invoke("server:get-statistics", serverId),
  createMinecraftServer: (
    serverName: string,
    version: string,
    serverType: "vanilla" | "forge" | "neoforge",
    overwrite?: boolean,
  ): Promise<{
    success: boolean;
    error?: string;
    errorCode?: "SERVER_EXISTS" | "JAVA_NOT_FOUND" | "NETWORK_ERROR" | "UNKNOWN";
  }> =>
    ipcRenderer.invoke(
      "server:create-minecraft-server",
      serverName,
      version,
      serverType,
      overwrite,
    ),
  onCreateProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
      callback(message);
    ipcRenderer.on("server:create-progress", listener);
    return () => ipcRenderer.removeListener("server:create-progress", listener);
  },
  deleteFromS3: (
    config: S3ConfigType,
    serverId: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("server:delete-from-s3", config, serverId),
  deleteLocally: (serverId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("server:delete-locally", serverId),
  listLocalServers: (): Promise<
    Array<{ id: string; name: string; version: string; type: "vanilla" | "forge" | "neoforge" | "unknown" }>
  > => ipcRenderer.invoke("server:list-local"),
};

const javaAPI = {
  ensureForMinecraft: (
    minecraftVersion: string,
  ): Promise<{ success: boolean; javaPath: string; javaVersion: number }> =>
    ipcRenderer.invoke("java:ensure-for-minecraft", minecraftVersion),
  getInstalledVersions: (): Promise<Array<{ version: number; path: string }>> =>
    ipcRenderer.invoke("java:get-installed-versions"),
  getRequiredVersion: (minecraftVersion: string): Promise<number> =>
    ipcRenderer.invoke("java:get-required-version", minecraftVersion),
  onProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
      callback(message);
    ipcRenderer.on("java:progress", listener);
    return () => ipcRenderer.removeListener("java:progress", listener);
  },
};

const notificationAPI = {
  show: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke("notification:show", title, body),
};

const p2pAPI = {
  listGroups: (): Promise<P2PGroup[]> => ipcRenderer.invoke("p2p:list-groups"),
  createGroup: (name: string): Promise<P2PGroup> => ipcRenderer.invoke("p2p:create-group", name),
  joinGroup: (code: string): Promise<P2PGroup> => ipcRenderer.invoke("p2p:join-group", code),
  deleteGroup: (groupId: string): Promise<void> => ipcRenderer.invoke("p2p:delete-group", groupId),
  leaveGroup: (groupId: string): Promise<void> => ipcRenderer.invoke("p2p:leave-group", groupId),
  deleteMyData: (): Promise<void> => ipcRenderer.invoke("p2p:delete-my-data"),
  listMembers: (groupId: string): Promise<P2PMember[]> =>
    ipcRenderer.invoke("p2p:list-members", groupId),
  setDisplayName: (name: string): Promise<void> => ipcRenderer.invoke("p2p:set-display-name", name),
  getAblyToken: (): Promise<TokenRequest> => ipcRenderer.invoke("p2p:ably-token"),
  getTurnConfig: (): Promise<TurnConfig | null> => ipcRenderer.invoke("p2p:get-turn-config"),
  saveTurnConfig: (config: TurnConfig | null): Promise<void> =>
    ipcRenderer.invoke("p2p:save-turn-config", config),
  getIceServers: (): Promise<{ iceServers: RTCIceServer[] }> =>
    ipcRenderer.invoke("p2p:ice-servers"),
  clientListen: (port: number): Promise<number> => ipcRenderer.invoke("p2p:client-listen", port),
  hostConnect: (connId: string, port: number): void =>
    ipcRenderer.send("p2p:host-connect", connId, port),
  tcpWrite: (connId: string, data: Uint8Array): void =>
    ipcRenderer.send("p2p:tcp-write", connId, data),
  tcpEnd: (connId: string): void => ipcRenderer.send("p2p:tcp-end", connId),
  tcpPause: (connId: string): void => ipcRenderer.send("p2p:tcp-pause", connId),
  tcpResume: (connId: string): void => ipcRenderer.send("p2p:tcp-resume", connId),
  closeAll: (): void => ipcRenderer.send("p2p:close-all"),
  onTcpOpen: (callback: (connId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, connId: string): void => callback(connId);
    ipcRenderer.on("p2p:tcp-open", listener);
    return () => ipcRenderer.removeListener("p2p:tcp-open", listener);
  },
  onTcpData: (callback: (connId: string, data: Uint8Array<ArrayBuffer>) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      connId: string,
      data: Uint8Array<ArrayBuffer>,
    ): void => callback(connId, data);
    ipcRenderer.on("p2p:tcp-data", listener);
    return () => ipcRenderer.removeListener("p2p:tcp-data", listener);
  },
  onTcpClose: (callback: (connId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, connId: string): void => callback(connId);
    ipcRenderer.on("p2p:tcp-close", listener);
    return () => ipcRenderer.removeListener("p2p:tcp-close", listener);
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
    contextBridge.exposeInMainWorld("rclone", rcloneAPI);
    contextBridge.exposeInMainWorld("configAPI", configAPI);
    contextBridge.exposeInMainWorld("systemAPI", systemAPI);
    contextBridge.exposeInMainWorld("serverAPI", serverAPI);
    contextBridge.exposeInMainWorld("javaAPI", javaAPI);
    contextBridge.exposeInMainWorld("notificationAPI", notificationAPI);
    contextBridge.exposeInMainWorld("p2pAPI", p2pAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  const win = window as unknown as Record<string, unknown>;
  win.electron = electronAPI;
  win.api = api;
  win.rclone = rcloneAPI;
  win.configAPI = configAPI;
  win.systemAPI = systemAPI;
  win.serverAPI = serverAPI;
  win.javaAPI = javaAPI;
  win.notificationAPI = notificationAPI;
  win.p2pAPI = p2pAPI;
}
