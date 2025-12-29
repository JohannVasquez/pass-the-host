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
};

const configAPI = {
  loadConfig: (): Promise<any> => ipcRenderer.invoke("config:load"),
  saveR2Config: (r2Config: any): Promise<boolean> => ipcRenderer.invoke("config:save-r2", r2Config),
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
  } catch (error) {
    console.error(error);
  }
} else {
  (window as any).electron = electronAPI;
  (window as any).api = api;
  (window as any).rclone = rcloneAPI;
  (window as any).configAPI = configAPI;
}
