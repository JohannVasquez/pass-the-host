import { initializeMainContainer } from "@main/di/container";
import { ServerRuntimeIPCHandlers } from "@main/contexts/server-runtime/infrastructure/ipc/ServerRuntimeIPCHandlers";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "@main/contexts/server-runtime/application/use-cases";
import { CloudStorageIPCHandlers } from "@main/contexts/cloud-storage/infrastructure/ipc/CloudStorageIPCHandlers";
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
  GetBucketSizeUseCase,
  GetServerSizeUseCase,
} from "@main/contexts/cloud-storage/application/use-cases";
import { registerServerLifecycleIPCHandlers } from "@main/contexts/server-lifecycle/infrastructure/ipc";
import { registerSystemResourcesIPCHandlers } from "@main/contexts/system-resources/infrastructure/ipc";
import { registerAppConfigurationIPCHandlers } from "@main/contexts/app-configuration/infrastructure/ipc";
import { LoadConfigUseCase } from "@main/contexts/app-configuration/application/use-cases";
import { TYPES as ConfigTYPES } from "@main/contexts/app-configuration/application/use-cases/types";
import { Container } from "inversify";
import { app, shell, BrowserWindow, ipcMain, Tray, nativeImage, Menu, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import { logger } from "@shared/infrastructure/logger";
/**
 * Extended logger interface for electron-updater
 */
interface UpdaterLogger {
  transports: {
    file: {
      level: string | false;
    };
  };
}
// Configure electron-log for autoUpdater
autoUpdater.logger = logger.getLog();
if (autoUpdater.logger && "transports" in autoUpdater.logger) {
  (autoUpdater.logger as unknown as UpdaterLogger).transports.file.level = "info";
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
    logger.info("Checking for updates...");
  });
  autoUpdater.on("update-available", (info) => {
    logger.info("Update available:", info);
  });
  autoUpdater.on("update-not-available", (info) => {
    logger.info("Update not available:", info);
  });
  autoUpdater.on("error", (err) => {
    logger.error("Error in auto-updater:", err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    logger.info(
      `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`,
    );
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
  logger.warn("Another instance is already running. Quitting...");
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
    logger.info("=".repeat(60));
    logger.info("Application starting...");
    logger.info(`Version: ${app.getVersion()}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Node: ${process.versions.node}`);
    logger.info(`Electron: ${process.versions.electron}`);
    logger.info("=".repeat(60));
    // Initialize Inversify container and register all contexts
    const container = initializeMainContainer();
    logger.info("DI Container initialized");
    // Set app user model id for windows
    electronApp.setAppUserModelId("com.electron");
    createWindow();
    logger.info("Main window created");
    createTray();
    logger.info("System tray created");
    setupAutoUpdater(container);
    logger.info("Auto-updater configured");

    ipcMain.on("ping", () => console.debug("pong"));
    const serverRuntimeIPCHandlers = new ServerRuntimeIPCHandlers(
      container.get(SpawnServerProcessUseCase),
      container.get(SendCommandUseCase),
      container.get(KillServerProcessUseCase),
      container.get(ReadForgeJvmArgsUseCase),
      container.get(EditForgeJvmArgsUseCase),
      container.get(OpenServerFolderUseCase),
    );
    serverRuntimeIPCHandlers.register();
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
      container.get(WriteServerPortUseCase),
      container.get(GetBucketSizeUseCase),
      container.get(GetServerSizeUseCase),
    );
    cloudStorageIPCHandlers.register();
    logger.info("Cloud Storage IPC handlers registered");
    // ===== SERVER LIFECYCLE HANDLERS =====
    registerServerLifecycleIPCHandlers(container);
    logger.info("Server Lifecycle IPC handlers registered");
    // ===== SYSTEM RESOURCES HANDLERS =====
    registerSystemResourcesIPCHandlers(container);
    logger.info("System Resources IPC handlers registered");
    // ===== APP CONFIGURATION HANDLERS =====
    registerAppConfigurationIPCHandlers(container);
    logger.info("App Configuration IPC handlers registered");
    logger.info("All IPC handlers registered successfully");
    app.on("activate", function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("quit", () => {
    logger.info("Application shutting down");
    logger.info("=".repeat(60));
  });
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
