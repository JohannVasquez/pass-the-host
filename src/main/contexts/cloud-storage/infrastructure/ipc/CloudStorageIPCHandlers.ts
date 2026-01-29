import { ipcMain, IpcMainInvokeEvent } from "electron";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
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
} from "../../application/use-cases";
import type { R2Config } from "../../domain/entities";

export class CloudStorageIPCHandlers {
  constructor(
    private checkRcloneInstallationUseCase: CheckRcloneInstallationUseCase,
    private installRcloneUseCase: InstallRcloneUseCase,
    private testR2ConnectionUseCase: TestR2ConnectionUseCase,
    private listR2ServersUseCase: ListR2ServersUseCase,
    private downloadServerFromR2UseCase: DownloadServerFromR2UseCase,
    private uploadServerToR2UseCase: UploadServerToR2UseCase,
    private deleteServerFromR2UseCase: DeleteServerFromR2UseCase,
    private shouldDownloadServerUseCase: ShouldDownloadServerUseCase,
    private createServerLockUseCase: CreateServerLockUseCase,
    private readServerLockUseCase: ReadServerLockUseCase,
    private uploadServerLockUseCase: UploadServerLockUseCase,
    private deleteServerLockUseCase: DeleteServerLockUseCase,
    private deleteLocalServerLockUseCase: DeleteLocalServerLockUseCase,
    private createSessionUseCase: CreateSessionUseCase,
    private updateSessionUseCase: UpdateSessionUseCase,
    private uploadSessionUseCase: UploadSessionUseCase,
    private getServerStatisticsUseCase: GetServerStatisticsUseCase,
    private readServerPortUseCase: ReadServerPortUseCase,
    private writeServerPortUseCase: WriteServerPortUseCase,
  ) {}

  /**
   * Wraps an IPC handler with error handling
   */
  private handleIPC<T extends unknown[], R>(
    context: string,
    handler: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await handler(...args);
      } catch (error) {
        ErrorHandler.handle(error, `CloudStorageIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }

  register(): void {
    // Rclone handlers
    ipcMain.handle(
      "rclone:check-installation",
      this.handleIPC("checkRcloneInstallation", async () => {
        return await this.checkRcloneInstallationUseCase.execute();
      }),
    );

    ipcMain.handle(
      "rclone:install",
      this.handleIPC("installRclone", async (event: IpcMainInvokeEvent) => {
        const progressCallback = (message: string): void => {
          event.sender.send("rclone:progress", message);
        };
        return await this.installRcloneUseCase.execute(progressCallback);
      }),
    );

    ipcMain.handle(
      "rclone:test-r2-connection",
      this.handleIPC("testR2Connection", async (_event, config: R2Config) => {
        return await this.testR2ConnectionUseCase.execute(config);
      }),
    );

    // R2 Server handlers
    ipcMain.handle(
      "rclone:list-servers",
      this.handleIPC("listR2Servers", async (_event, config: R2Config) => {
        return await this.listR2ServersUseCase.execute(config);
      }),
    );

    ipcMain.handle(
      "rclone:download-server",
      this.handleIPC(
        "downloadServer",
        async (event: IpcMainInvokeEvent, config: R2Config, serverId: string) => {
          const progressCallback = (progress: {
            percent: number;
            transferred: string;
            total: string;
          }): void => {
            event.sender.send("rclone:transfer-progress", progress);
          };
          return await this.downloadServerFromR2UseCase.execute(config, serverId, progressCallback);
        },
      ),
    );

    ipcMain.handle(
      "rclone:upload-server",
      this.handleIPC(
        "uploadServer",
        async (event: IpcMainInvokeEvent, config: R2Config, serverId: string) => {
          const progressCallback = (progress: {
            percent: number;
            transferred: string;
            total: string;
          }): void => {
            event.sender.send("rclone:transfer-progress", progress);
          };
          return await this.uploadServerToR2UseCase.execute(config, serverId, progressCallback);
        },
      ),
    );

    ipcMain.handle(
      "server:delete-from-r2",
      this.handleIPC("deleteFromR2", async (_event, config: R2Config, serverId: string) => {
        return await this.deleteServerFromR2UseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:should-download",
      this.handleIPC("shouldDownload", async (_event, config: R2Config, serverId: string) => {
        return await this.shouldDownloadServerUseCase.execute(config, serverId);
      }),
    );

    // Server Lock handlers
    ipcMain.handle(
      "server:create-lock",
      this.handleIPC("createLock", async (_event, serverId: string, username: string) => {
        return this.createServerLockUseCase.execute(serverId, username);
      }),
    );

    ipcMain.handle(
      "server:read-server-lock",
      this.handleIPC("readLock", async (_event, r2Config: R2Config, serverId: string) => {
        return await this.readServerLockUseCase.execute(r2Config, serverId);
      }),
    );

    ipcMain.handle(
      "server:upload-lock",
      this.handleIPC("uploadLock", async (_event, config: R2Config, serverId: string) => {
        return await this.uploadServerLockUseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:delete-lock",
      this.handleIPC("deleteLock", async (_event, config: R2Config, serverId: string) => {
        return await this.deleteServerLockUseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:delete-local-lock",
      this.handleIPC("deleteLocalLock", async (_event, serverId: string) => {
        return this.deleteLocalServerLockUseCase.execute(serverId);
      }),
    );

    // Session handlers
    ipcMain.handle(
      "server:create-session",
      this.handleIPC("createSession", async (_event, serverId: string, username: string) => {
        return this.createSessionUseCase.execute(serverId, username);
      }),
    );

    ipcMain.handle(
      "server:update-session",
      this.handleIPC("updateSession", async (_event, serverId: string, username: string) => {
        return this.updateSessionUseCase.execute(serverId, username);
      }),
    );

    ipcMain.handle(
      "server:upload-session",
      this.handleIPC("uploadSession", async (_event, config: R2Config, serverId: string) => {
        return await this.uploadSessionUseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:get-statistics",
      this.handleIPC("getStatistics", async (_event, serverId: string) => {
        return this.getServerStatisticsUseCase.execute(serverId);
      }),
    );

    // Server Properties handlers
    ipcMain.handle(
      "server:read-port",
      this.handleIPC("readPort", async (_event, serverId: string) => {
        return this.readServerPortUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:write-port",
      this.handleIPC("writePort", async (_event, serverId: string, port: number) => {
        return this.writeServerPortUseCase.execute(serverId, port);
      }),
    );
  }
}
