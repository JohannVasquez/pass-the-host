import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// S3 provider types
type S3Provider = "AWS" | "Cloudflare" | "MinIO" | "Backblaze" | "DigitalOcean" | "Other";

interface S3ConfigType {
  provider: S3Provider;
  endpoint: string;
  region: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

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

const configAPI = {
  loadConfig: (): Promise<AppConfigData | null> => ipcRenderer.invoke("config:load"),
  saveS3Config: (s3Config: S3ConfigType): Promise<boolean> =>
    ipcRenderer.invoke("config:save-s3", s3Config),
  saveUsername: (username: string): Promise<boolean> =>
    ipcRenderer.invoke("config:save-username", username),
  saveRamConfig: (minRam: number, maxRam: number): Promise<boolean> =>
    ipcRenderer.invoke("config:save-ram", minRam, maxRam),
  saveLanguage: (language: string): Promise<boolean> =>
    ipcRenderer.invoke("config:save-language", language),
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
    serverType: "vanilla" | "forge",
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
}
