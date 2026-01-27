import { initializeMainContainer } from "./di/container";
import { ServerRuntimeIPCHandlers } from "./contexts/server-runtime/infrastructure/ipc/ServerRuntimeIPCHandlers";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "./contexts/server-runtime/application/use-cases";
import { CloudStorageIPCHandlers } from "./contexts/cloud-storage/infrastructure/ipc/CloudStorageIPCHandlers";
import {
  CheckRcloneInstallationUseCase,
  InstallRcloneUseCase,
  TestR2ConnectionUseCase,
  ListR2ServersUseCase,
  DownloadServerFromR2UseCase,
  UploadServerToR2UseCase,
  DeleteServerFromR2UseCase,
  ShouldDownloadServerUseCase,
  CreateServerLockUseCase,
  ReadServerLockUseCase,
  UploadServerLockUseCase,
  DeleteServerLockUseCase,
  DeleteLocalServerLockUseCase,
  CreateSessionUseCase,
  UpdateSessionUseCase,
  UploadSessionUseCase,
  GetServerStatisticsUseCase,
  ReadServerPortUseCase,
  WriteServerPortUseCase,
} from "./contexts/cloud-storage/application/use-cases";
import { registerServerLifecycleIPCHandlers } from "./contexts/server-lifecycle/infrastructure/ipc";
import { registerSystemResourcesIPCHandlers } from "./contexts/system-resources/infrastructure/ipc";
import { registerAppConfigurationIPCHandlers } from "./contexts/app-configuration/infrastructure/ipc";
import { LoadConfigUseCase } from "./contexts/app-configuration/application/use-cases";
import { TYPES as ConfigTYPES } from "./contexts/app-configuration/application/use-cases/types";
import { Container } from "inversify";
import { app, shell, BrowserWindow, ipcMain, Tray, nativeImage, Menu, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

// Configure electron-log for autoUpdater
autoUpdater.logger = log;
if (autoUpdater.logger && "transports" in autoUpdater.logger) {
  (autoUpdater.logger as typeof log).transports.file.level = "info";
}

// ===== SERVER RUNTIME HANDLERS - MOVED TO CONTEXT =====
// All server process management has been moved to server-runtime context
// The following handlers are now registered via ServerRuntimeIPCHandlers:
// - server:spawn-server-process
// - server:send-command
// - server:kill-server-process
// - server:edit-forge-jvm-args
// - server:read-forge-jvm-args
// - server:openFolder

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const icon = nativeImage.createFromPath(join(__dirname, "../../resources/icon.png"));

// Auto-updater functions
function setupAutoUpdater(container: Container): void {
  // Handle update-downloaded event
  autoUpdater.on("update-downloaded", async (event) => {
    // Get language from config
    const loadConfigUseCase = container.get<LoadConfigUseCase>(ConfigTYPES.LoadConfigUseCase);
    const config = await loadConfigUseCase.execute();
    const language = config?.app?.language || "en";

    // Messages in different languages
    const messages: {
      [key: string]: {
        title: string;
        message: string;
        detail: string;
        restartNow: string;
        later: string;
      };
    } = {
      en: {
        title: "Application Update",
        message: event.version || "Update Available",
        detail: "A new version has been downloaded. Restart the application to apply the updates.",
        restartNow: "Restart now",
        later: "Later",
      },
      es: {
        title: "Actualización de la Aplicación",
        message: event.version || "Actualización Disponible",
        detail:
          "Se ha descargado una nueva versión. Reinicia la aplicación para aplicar las actualizaciones.",
        restartNow: "Reiniciar ahora",
        later: "Más tarde",
      },
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
    // Initialize Inversify container and register all contexts
    const container = initializeMainContainer();

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
    setupAutoUpdater(container);

    // IPC test
    ipcMain.on("ping", () => console.debug("pong"));

    // ========== SERVER RUNTIME CONTEXT IPC HANDLERS ==========
    const serverRuntimeIPCHandlers = new ServerRuntimeIPCHandlers(
      container.get(SpawnServerProcessUseCase),
      container.get(SendCommandUseCase),
      container.get(KillServerProcessUseCase),
      container.get(ReadForgeJvmArgsUseCase),
      container.get(EditForgeJvmArgsUseCase),
      container.get(OpenServerFolderUseCase)
    );
    serverRuntimeIPCHandlers.register();

    // ========== CLOUD STORAGE CONTEXT IPC HANDLERS ==========
    const cloudStorageIPCHandlers = new CloudStorageIPCHandlers(
      container.get(CheckRcloneInstallationUseCase),
      container.get(InstallRcloneUseCase),
      container.get(TestR2ConnectionUseCase),
      container.get(ListR2ServersUseCase),
      container.get(DownloadServerFromR2UseCase),
      container.get(UploadServerToR2UseCase),
      container.get(DeleteServerFromR2UseCase),
      container.get(ShouldDownloadServerUseCase),
      container.get(CreateServerLockUseCase),
      container.get(ReadServerLockUseCase),
      container.get(UploadServerLockUseCase),
      container.get(DeleteServerLockUseCase),
      container.get(DeleteLocalServerLockUseCase),
      container.get(CreateSessionUseCase),
      container.get(UpdateSessionUseCase),
      container.get(UploadSessionUseCase),
      container.get(GetServerStatisticsUseCase),
      container.get(ReadServerPortUseCase),
      container.get(WriteServerPortUseCase)
    );
    cloudStorageIPCHandlers.register();

    // ===== CLOUD STORAGE HANDLERS - MOVED TO CONTEXT =====
    // All rclone, R2, locks, sessions, and properties handlers moved to cloud-storage context
    // The following handlers are now registered via CloudStorageIPCHandlers:
    // - rclone:check-installation, rclone:install, rclone:test-r2-connection
    // - rclone:list-servers, rclone:download-server, rclone:upload-server
    // - server:create-lock, server:read-server-lock, server:upload-lock
    // - server:delete-lock, server:delete-local-lock
    // - server:read-port, server:write-port
    // - server:create-session, server:update-session, server:upload-session
    // - server:should-download, server:get-statistics, server:delete-from-r2

    // ===== APP CONFIGURATION HANDLERS =====
    registerAppConfigurationIPCHandlers(container);

    // ===== SERVER LIFECYCLE HANDLERS =====
    registerServerLifecycleIPCHandlers(container);

    // ===== SYSTEM RESOURCES HANDLERS =====
    registerSystemResourcesIPCHandlers(container);

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
