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
  ReadServerPropertiesUseCase,
  WriteServerPropertiesUseCase,
  ReadWhitelistUseCase,
  WriteWhitelistUseCase,
  LookupPlayerUseCase,
  ManageWorldUseCase,
  GetBucketSizeUseCase,
  GetServerSizeUseCase,
  AuthorizeGoogleDriveUseCase,
  ShareGoogleDriveServerUseCase,
  CancelGoogleDriveAuthorizationUseCase,
} from "@main/contexts/cloud-storage/application/use-cases";
import type { S3Config } from "@main/contexts/cloud-storage/domain/entities";
import type { WhitelistEntry } from "@main/contexts/cloud-storage/domain/repositories";

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
    private readServerPropertiesUseCase: ReadServerPropertiesUseCase,
    private writeServerPropertiesUseCase: WriteServerPropertiesUseCase,
    private readWhitelistUseCase: ReadWhitelistUseCase,
    private writeWhitelistUseCase: WriteWhitelistUseCase,
    private lookupPlayerUseCase: LookupPlayerUseCase,
    private manageWorldUseCase: ManageWorldUseCase,
    private getBucketSizeUseCase: GetBucketSizeUseCase,
    private getServerSizeUseCase: GetServerSizeUseCase,
    private authorizeGoogleDriveUseCase: AuthorizeGoogleDriveUseCase,
    private shareGoogleDriveServerUseCase: ShareGoogleDriveServerUseCase,
    private cancelGoogleDriveAuthorizationUseCase: CancelGoogleDriveAuthorizationUseCase,
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

    // Support both legacy and new channel names for S3 connection test
    ipcMain.handle(
      "rclone:test-s3-connection",
      this.handleIPC("testS3Connection", async (_event, config: S3Config) => {
        return await this.testR2ConnectionUseCase.execute(config);
      }),
    );

    // Legacy channel for backward compatibility
    ipcMain.handle(
      "rclone:test-r2-connection",
      this.handleIPC("testR2Connection", async (_event, config: S3Config) => {
        return await this.testR2ConnectionUseCase.execute(config);
      }),
    );

    ipcMain.handle(
      "rclone:authorize-drive",
      this.handleIPC("authorizeDrive", async () => {
        return await this.authorizeGoogleDriveUseCase.execute();
      }),
    );

    ipcMain.handle(
      "rclone:cancel-authorize-drive",
      this.handleIPC("cancelAuthorizeDrive", async () => {
        this.cancelGoogleDriveAuthorizationUseCase.execute();
      }),
    );

    ipcMain.handle(
      "rclone:share-drive-server",
      this.handleIPC(
        "shareDriveServer",
        async (_event, config: S3Config, serverId: string, email: string) => {
          return await this.shareGoogleDriveServerUseCase.execute(config, serverId, email);
        },
      ),
    );

    // S3 Server handlers
    ipcMain.handle(
      "rclone:list-servers",
      this.handleIPC("listServers", async (_event, config: S3Config) => {
        return await this.listR2ServersUseCase.execute(config);
      }),
    );

    ipcMain.handle(
      "rclone:download-server",
      this.handleIPC(
        "downloadServer",
        async (event: IpcMainInvokeEvent, config: S3Config, serverId: string) => {
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
        async (event: IpcMainInvokeEvent, config: S3Config, serverId: string) => {
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

    // Support both legacy and new channel names for S3 delete
    ipcMain.handle(
      "server:delete-from-s3",
      this.handleIPC("deleteFromS3", async (_event, config: S3Config, serverId: string) => {
        return await this.deleteServerFromR2UseCase.execute(config, serverId);
      }),
    );

    // Legacy channel for backward compatibility
    ipcMain.handle(
      "server:delete-from-r2",
      this.handleIPC("deleteFromR2", async (_event, config: S3Config, serverId: string) => {
        return await this.deleteServerFromR2UseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:should-download",
      this.handleIPC("shouldDownload", async (_event, config: S3Config, serverId: string) => {
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
      this.handleIPC("readLock", async (_event, s3Config: S3Config, serverId: string) => {
        return await this.readServerLockUseCase.execute(s3Config, serverId);
      }),
    );

    ipcMain.handle(
      "server:upload-lock",
      this.handleIPC("uploadLock", async (_event, config: S3Config, serverId: string) => {
        return await this.uploadServerLockUseCase.execute(config, serverId);
      }),
    );

    ipcMain.handle(
      "server:delete-lock",
      this.handleIPC("deleteLock", async (_event, config: S3Config, serverId: string) => {
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
      this.handleIPC("uploadSession", async (_event, config: S3Config, serverId: string) => {
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

    ipcMain.handle(
      "server:read-properties",
      this.handleIPC("readProperties", async (_event, serverId: string) => {
        return this.readServerPropertiesUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:write-properties",
      this.handleIPC(
        "writeProperties",
        async (_event, serverId: string, properties: Record<string, string>) => {
          return this.writeServerPropertiesUseCase.execute(serverId, properties);
        },
      ),
    );

    ipcMain.handle(
      "server:export-world",
      this.handleIPC("exportWorld", async (_event, serverId: string) => {
        return this.manageWorldUseCase.exportWorld(serverId);
      }),
    );

    ipcMain.handle(
      "server:import-world",
      this.handleIPC("importWorld", async (_event, serverId: string) => {
        return this.manageWorldUseCase.importWorld(serverId);
      }),
    );

    ipcMain.handle(
      "server:reset-world",
      this.handleIPC("resetWorld", async (_event, serverId: string, levelNames: string[]) => {
        return this.manageWorldUseCase.resetWorld(serverId, levelNames);
      }),
    );

    ipcMain.handle(
      "server:read-whitelist",
      this.handleIPC("readWhitelist", async (_event, serverId: string) => {
        return this.readWhitelistUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:write-whitelist",
      this.handleIPC(
        "writeWhitelist",
        async (_event, serverId: string, entries: WhitelistEntry[]) => {
          return this.writeWhitelistUseCase.execute(serverId, entries);
        },
      ),
    );

    ipcMain.handle(
      "server:lookup-player",
      this.handleIPC("lookupPlayer", async (_event, name: string, onlineMode: boolean) => {
        return await this.lookupPlayerUseCase.execute(name, onlineMode);
      }),
    );

    // Storage size handlers
    ipcMain.handle(
      "cloud-storage:get-bucket-size",
      this.handleIPC("getBucketSize", async (_event, config: S3Config) => {
        return await this.getBucketSizeUseCase.execute(config);
      }),
    );

    ipcMain.handle(
      "cloud-storage:get-server-size",
      this.handleIPC("getServerSize", async (_event, config: S3Config, serverId: string) => {
        return await this.getServerSizeUseCase.execute(config, serverId);
      }),
    );
  }
}
