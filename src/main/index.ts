import { getLocalServerPath } from "./rclone";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { app, shell, BrowserWindow, ipcMain, Tray, nativeImage, Menu, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import {
  checkRcloneInstallation,
  installRclone,
  testR2Connection,
  listR2Servers,
  downloadServerFromR2,
  uploadServerToR2,
  createServerLock,
  readServerLock,
  uploadServerLock,
  deleteServerLock,
  deleteLocalServerLock,
  readServerPort,
  writeServerPort,
} from "./rclone";
import { saveR2Config, loadConfig, saveUsername, saveRamConfig, saveLanguage } from "./config";
import { ensureJavaForMinecraft, getInstalledJavaVersions, getRequiredJavaVersion } from "./java";
import os from "os";

// Configure electron-log for autoUpdater
autoUpdater.logger = log;
if (autoUpdater.logger && "transports" in autoUpdater.logger) {
  (autoUpdater.logger as typeof log).transports.file.level = "info";
}

const serverProcesses: Record<string, ChildProcessWithoutNullStreams> = {};

// Get local server path
ipcMain.handle("server:get-local-server-path", async (_event, serverId) => {
  return getLocalServerPath(serverId);
});

// Spawn Minecraft server process
ipcMain.handle(
  "server:spawn-server-process",
  async (event, serverId, command, args, workingDir) => {
    return new Promise((resolve, reject) => {
      try {
        if (serverProcesses[serverId]) {
          return reject(new Error("Server process already running"));
        }

        // Auto accept EULA
        const eulaPath = path.join(workingDir, "eula.txt");
        if (!fs.existsSync(eulaPath) || !fs.readFileSync(eulaPath, "utf-8").includes("eula=true")) {
          try {
            fs.writeFileSync(eulaPath, "eula=true");
          } catch (e) {}
        }

        const proc = spawn(command, args, {
          cwd: workingDir,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });

        serverProcesses[serverId] = proc;

        proc.stdout.on("data", (data) => {
          if (!event.sender.isDestroyed()) {
            // Convertimos buffer a string para enviarlo
            event.sender.send("server:stdout", data.toString());
          }
        });

        proc.stderr.on("data", (data) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("server:stdout", data.toString());
          }
        });

        proc.on("close", (_code) => {
          delete serverProcesses[serverId];
        });

        resolve(true);
      } catch (e) {
        reject(e);
      }
    });
  }
);

// Kill Minecraft server process (safe stop)
ipcMain.handle("server:kill-server-process", async (_event, serverId) => {
  return new Promise((resolve, _) => {
    const proc = serverProcesses[serverId];
    if (!proc) return resolve(false);
    try {
      // Send 'stop' command to stdin for safe shutdown
      proc.stdin.write("stop\n");
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill();
        }
        delete serverProcesses[serverId];
        resolve(true);
      }, 8000); // Give it 8 seconds to shutdown gracefully
    } catch (e) {
      try {
        proc.kill();
      } catch {}
      delete serverProcesses[serverId];
      resolve(false);
    }
  });
});

// Edit Forge user_jvm_args.txt for RAM
ipcMain.handle("server:edit-forge-jvm-args", async (_event, serverId, minRam, maxRam) => {
  try {
    const serverPath = getLocalServerPath(serverId);
    const jvmArgsPath = path.join(serverPath, "user_jvm_args.txt");
    if (!fs.existsSync(jvmArgsPath)) return false;
    let content = fs.readFileSync(jvmArgsPath, "utf-8");
    content = content.replace(/-Xms\d+[mMgG]/g, `-Xms${minRam}G`);
    content = content.replace(/-Xmx\d+[mMgG]/g, `-Xmx${maxRam}G`);
    fs.writeFileSync(jvmArgsPath, content, "utf-8");
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle("server:openFolder", async (_event, serverId: string) => {
  try {
    const serverPath = path.join(app.getPath("userData"), "servers", serverId);

    if (!fs.existsSync(serverPath)) {
      console.error(`La carpeta del servidor no existe: ${serverPath}`);
      return false;
    }

    const errorMessage = await shell.openPath(serverPath);

    if (errorMessage) {
      console.error("Error al abrir la carpeta:", errorMessage);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Excepción al abrir carpeta:", error);
    return false;
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const icon = nativeImage.createFromPath(join(__dirname, "../../resources/icon.png"));

// Auto-updater functions
function setupAutoUpdater(): void {
  // Handle update-downloaded event
  autoUpdater.on("update-downloaded", (event) => {
    const language = loadConfig()?.app?.language || "en";
    
    // Messages in different languages
    const messages: { [key: string]: { title: string; message: string; detail: string; restartNow: string; later: string } } = {
      en: {
        title: "Application Update",
        message: event.version || "Update Available",
        detail: "A new version has been downloaded. Restart the application to apply the updates.",
        restartNow: "Restart now",
        later: "Later"
      },
      es: {
        title: "Actualización de la Aplicación",
        message: event.version || "Actualización Disponible",
        detail: "Se ha descargado una nueva versión. Reinicia la aplicación para aplicar las actualizaciones.",
        restartNow: "Reiniciar ahora",
        later: "Más tarde"
      }
    };
    
    const msg = messages[language] || messages["en"];
    
    const dialogOpts = {
      type: "info" as const,
      buttons: [msg.restartNow, msg.later],
      title: msg.title,
      message: msg.message,
      detail: msg.detail,
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        // User clicked "Restart now"
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Optional: Log update events
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info);
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("Update not available:", info);
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater:", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    log.info(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,

    icon: icon,

    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();

    // Check for updates when window is ready
    if (!is.dev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// System tray config
function createTray() {
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir Pass the host",
      click: () => mainWindow?.show(),
    },
    { type: "separator" },
    {
      label: "Cerrar App (Kill Server)",
      click: () => {
        isQuitting = true; // Asegúrate de tener esta variable global importada o definida
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Pass the host");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow?.show();
  });

  // Tip: En Windows, a veces prefieren un solo click para abrir
  tray.on("click", () => {
    mainWindow?.show();
  });
}

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // Handle when user tries to run a second instance
  app.on("second-instance", () => {
    // Focus on the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId("com.electron");

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createWindow();
    createTray();
    setupAutoUpdater();

    // IPC test
    ipcMain.on("ping", () => console.debug("pong"));

    // Config IPC handlers
    ipcMain.handle("config:load", async () => {
      return loadConfig();
    });

    ipcMain.handle("config:save-r2", async (_, r2Config) => {
      return saveR2Config(r2Config);
    });

    ipcMain.handle("config:save-username", async (_, username) => {
      return saveUsername(username);
    });

    ipcMain.handle("config:save-ram", async (_, minRam, maxRam) => {
      return saveRamConfig(minRam, maxRam);
    });

    ipcMain.handle("config:save-language", async (_, language) => {
      return saveLanguage(language);
    });

    // Rclone IPC handlers
    ipcMain.handle("rclone:check-installation", async () => {
      return await checkRcloneInstallation();
    });

    ipcMain.handle("rclone:install", async (event) => {
      const progressCallback = (message: string): void => {
        event.sender.send("rclone:progress", message);
      };
      return await installRclone(progressCallback);
    });

    ipcMain.handle("rclone:test-r2-connection", async (_, config) => {
      return await testR2Connection(config);
    });

    ipcMain.handle("rclone:list-servers", async (_, config) => {
      return await listR2Servers(config);
    });

    ipcMain.handle("rclone:download-server", async (event, config, serverId) => {
      const progressCallback = (percent: number, transferred: string, total: string): void => {
        event.sender.send("rclone:transfer-progress", { percent, transferred, total });
      };
      return await downloadServerFromR2(config, serverId, progressCallback);
    });

    ipcMain.handle("rclone:upload-server", async (event, config, serverId) => {
      const progressCallback = (percent: number, transferred: string, total: string): void => {
        event.sender.send("rclone:transfer-progress", { percent, transferred, total });
      };
      return await uploadServerToR2(config, serverId, progressCallback);
    });

    ipcMain.handle("server:create-lock", async (_, serverId, username) => {
      return createServerLock(serverId, username);
    });

    ipcMain.handle("server:read-server-lock", async (_, r2Config, serverId) => {
      const result = await readServerLock(r2Config, serverId);
      return result;
    });

    ipcMain.handle("server:upload-lock", async (_, config, serverId) => {
      return await uploadServerLock(config, serverId);
    });

    ipcMain.handle("server:delete-lock", async (_, config, serverId) => {
      return await deleteServerLock(config, serverId);
    });

    ipcMain.handle("server:delete-local-lock", async (_, serverId) => {
      return deleteLocalServerLock(serverId);
    });

    ipcMain.handle("server:read-port", async (_, serverId) => {
      return readServerPort(serverId);
    });

    ipcMain.handle("server:write-port", async (_, serverId, port) => {
      return writeServerPort(serverId, port);
    });

    // System IPC handlers
    ipcMain.handle("system:get-total-memory", async () => {
      const totalMemoryBytes = os.totalmem();
      const totalMemoryGB = Math.floor(totalMemoryBytes / 1024 ** 3);
      return totalMemoryGB;
    });

    ipcMain.handle("system:get-network-interfaces", async () => {
      const interfaces = os.networkInterfaces();
      const networkList: Array<{ name: string; ip: string }> = [];

      for (const [name, addresses] of Object.entries(interfaces)) {
        if (!addresses) continue;

        for (const addr of addresses) {
          // Filter only IPv4 addresses
          if (addr.family === "IPv4" && !addr.internal) {
            networkList.push({
              name: name,
              ip: addr.address,
            });
          }
        }
      }

      // Add localhost
      networkList.push({
        name: "Localhost",
        ip: "127.0.0.1",
      });

      return networkList;
    });

    // Java IPC handlers
    ipcMain.handle("java:ensure-for-minecraft", async (event, minecraftVersion: string) => {
      const progressCallback = (message: string): void => {
        event.sender.send("java:progress", message);
      };
      return await ensureJavaForMinecraft(minecraftVersion, progressCallback);
    });

    ipcMain.handle("java:get-installed-versions", async () => {
      return getInstalledJavaVersions();
    });

    ipcMain.handle("java:get-required-version", async (_, minecraftVersion: string) => {
      return getRequiredJavaVersion(minecraftVersion);
    });

    app.on("activate", function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
