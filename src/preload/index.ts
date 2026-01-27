import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Custom APIs for renderer
const api = {};

// Rclone API
const rcloneAPI = {
  checkInstallation: (): Promise<boolean> => ipcRenderer.invoke("rclone:check-installation"),
  installRclone: (): Promise<boolean> => ipcRenderer.invoke("rclone:install"),
  testR2Connection: (config: any): Promise<boolean> =>
    ipcRenderer.invoke("rclone:test-r2-connection", config),
  listServers: (
    config: any
  ): Promise<Array<{ id: string; name: string; version: string; type: string }>> =>
    ipcRenderer.invoke("rclone:list-servers", config),
  downloadServer: (config: any, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("rclone:download-server", config, serverId),
  uploadServer: (config: any, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("rclone:upload-server", config, serverId),
  onProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: any, message: string): void => callback(message);
    ipcRenderer.on("rclone:progress", listener);
    return () => ipcRenderer.removeListener("rclone:progress", listener);
  },
  onTransferProgress: (
    callback: (progress: { percent: number; transferred: string; total: string }) => void
  ): (() => void) => {
    const listener = (
      _event: any,
      progress: { percent: number; transferred: string; total: string }
    ): void => callback(progress);
    ipcRenderer.on("rclone:transfer-progress", listener);
    return () => ipcRenderer.removeListener("rclone:transfer-progress", listener);
  },
};

const configAPI = {
  loadConfig: (): Promise<any> => ipcRenderer.invoke("config:load"),
  saveR2Config: (r2Config: any): Promise<boolean> => ipcRenderer.invoke("config:save-r2", r2Config),
  saveUsername: (username: string): Promise<boolean> =>
    ipcRenderer.invoke("config:save-username", username),
  saveRamConfig: (minRam: number, maxRam: number): Promise<boolean> =>
    ipcRenderer.invoke("config:save-ram", minRam, maxRam),
  saveLanguage: (language: string): Promise<boolean> =>
    ipcRenderer.invoke("config:save-language", language),
};

const systemAPI = {
  getTotalMemoryGB: (): Promise<number> => ipcRenderer.invoke("system:get-total-memory"),
  getNetworkInterfaces: (): Promise<Array<{ name: string; ip: string }>> =>
    ipcRenderer.invoke("system:get-network-interfaces"),
};

const serverAPI = {
  createLock: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:create-lock", serverId, username),
  readLock: (
    r2Config: any,
    serverId: string
  ): Promise<{ exists: boolean; username?: string; startedAt?: string; timestamp?: number }> => {
    return ipcRenderer.invoke("server:read-server-lock", r2Config, serverId);
  },
  uploadLock: (config: any, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:upload-lock", config, serverId),
  deleteLock: (config: any, serverId: string): Promise<boolean> =>
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
    workingDir: string
  ): Promise<boolean> =>
    ipcRenderer.invoke("server:spawn-server-process", serverId, command, args, workingDir),
  killServerProcess: (serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:kill-server-process", serverId),
  editForgeJvmArgs: (serverId: string, minRam: number, maxRam: number): Promise<boolean> =>
    ipcRenderer.invoke("server:edit-forge-jvm-args", serverId, minRam, maxRam),
  readForgeJvmArgs: (serverId: string): Promise<{ allArgs: string[] } | null> =>
    ipcRenderer.invoke("server:read-forge-jvm-args", serverId),
  onStdout: (callback: (data: string) => void): (() => void) => {
    const listener = (_event: any, data: string): void => callback(data);
    ipcRenderer.on("server:stdout", listener);
    return () => ipcRenderer.removeListener("server:stdout", listener);
  },
  sendCommand: (serverId: string, command: string): Promise<boolean> =>
    ipcRenderer.invoke("server:send-command", serverId, command),
  openServerFolder: (serverId: string) => ipcRenderer.invoke("server:openFolder", serverId),
  createSession: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:create-session", serverId, username),
  updateSession: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:update-session", serverId, username),
  uploadSession: (config: any, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:upload-session", config, serverId),
  shouldDownload: (config: any, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke("server:should-download", config, serverId),
  getStatistics: (serverId: string): Promise<any> =>
    ipcRenderer.invoke("server:get-statistics", serverId),
  createMinecraftServer: (
    serverName: string,
    version: string,
    serverType: "vanilla" | "forge"
  ): Promise<boolean> =>
    ipcRenderer.invoke("server:create-minecraft-server", serverName, version, serverType),
  onCreateProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: any, message: string): void => callback(message);
    ipcRenderer.on("server:create-progress", listener);
    return () => ipcRenderer.removeListener("server:create-progress", listener);
  },
  deleteFromR2: (config: any, serverId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("server:delete-from-r2", config, serverId),
  deleteLocally: (serverId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("server:delete-locally", serverId),
};

const javaAPI = {
  ensureForMinecraft: (
    minecraftVersion: string
  ): Promise<{ success: boolean; javaPath: string; javaVersion: number }> =>
    ipcRenderer.invoke("java:ensure-for-minecraft", minecraftVersion),
  getInstalledVersions: (): Promise<Array<{ version: number; path: string }>> =>
    ipcRenderer.invoke("java:get-installed-versions"),
  getRequiredVersion: (minecraftVersion: string): Promise<number> =>
    ipcRenderer.invoke("java:get-required-version", minecraftVersion),
  onProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: any, message: string): void => callback(message);
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
  (window as any).electron = electronAPI;
  (window as any).api = api;
  (window as any).rclone = rcloneAPI;
  (window as any).configAPI = configAPI;
  (window as any).systemAPI = systemAPI;
  (window as any).serverAPI = serverAPI;
  (window as any).javaAPI = javaAPI;
}
