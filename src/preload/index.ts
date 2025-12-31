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
};

const systemAPI = {
  getTotalMemoryGB: (): Promise<number> => ipcRenderer.invoke("system:get-total-memory"),
  getNetworkInterfaces: (): Promise<Array<{ name: string; ip: string }>> =>
    ipcRenderer.invoke("system:get-network-interfaces"),
};

const serverAPI = {
  createLock: (serverId: string, username: string): Promise<boolean> =>
    ipcRenderer.invoke("server:create-lock", serverId, username),
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
  onStdout: (callback: (data: string) => void): (() => void) => {
    const listener = (_event: any, data: string): void => callback(data);
    ipcRenderer.on("server:stdout", listener);
    return () => ipcRenderer.removeListener("server:stdout", listener);
  },
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
