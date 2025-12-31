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
}
