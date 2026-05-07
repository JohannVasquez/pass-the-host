import type { LogEntry } from "@renderer/domain/entities/LogEntry";
import type { S3Config } from "@renderer/domain/entities/ServerConfig";
import { ServerStatus } from "@renderer/domain/entities/ServerStatus";

type LogType = LogEntry["type"];

export interface StopManagedServerRequest {
  serverId: string;
  username: string;
  s3Config: S3Config;
  isCloudSyncEnabled: boolean;
}

export interface StopManagedServerDependencies {
  killServerProcess(serverId: string): Promise<boolean>;
  waitForServerExit(serverId: string): Promise<boolean>;
  deleteLock(config: S3Config, serverId: string): Promise<boolean>;
  deleteLocalLock(serverId: string): Promise<boolean>;
  updateSession(serverId: string, username: string): Promise<boolean>;
  uploadServer(serverId: string): Promise<boolean>;
  uploadSession(config: S3Config, serverId: string): Promise<boolean>;
}

export interface StopManagedServerPresenter {
  log(message: string, type: LogType): void;
  updateStatus(next: ServerStatus, reason: string, options?: { force?: boolean }): void;
  startTransfer(type: "download" | "upload", transferred?: string, total?: string): void;
  updateTransfer(transferred: string, total: string): void;
  stopTransfer(): void;
  setServerStartTime(startTime: Date | null): void;
}

export class StopManagedServerUseCase {
  constructor(
    private readonly dependencies: StopManagedServerDependencies,
    private readonly presenter: StopManagedServerPresenter,
  ) {}

  async execute(request: StopManagedServerRequest): Promise<void> {
    this.presenter.updateStatus(ServerStatus.STOPPING, "stop flow initiated");
    this.presenter.log("Stopping server...", "info");

    const serverExitPromise = this.dependencies.waitForServerExit(request.serverId);
    const killed = await this.dependencies.killServerProcess(request.serverId);

    if (!killed) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "stop flow failed");
      throw new Error("Error stopping server: process could not be killed");
    }

    const processExited = await serverExitPromise;
    if (!processExited) {
      this.presenter.log(
        "Server exit confirmation timed out, continuing shutdown tasks...",
        "warning",
      );
    }

    try {
      if (request.isCloudSyncEnabled) {
        this.presenter.startTransfer(
          "upload",
          "Finalizing server shutdown...",
          "Preparing cloud sync...",
        );
      }

      await this.deleteRemoteLockIfNeeded(request);
      await this.deleteLocalLock(request.serverId, request.isCloudSyncEnabled);
      const sessionUpdateSuccess = await this.updateSession(request);
      await this.uploadServerIfNeeded(request, sessionUpdateSuccess);
    } finally {
      this.presenter.stopTransfer();
      this.presenter.setServerStartTime(null);
      this.presenter.updateStatus(ServerStatus.STOPPED, "stop flow completed", { force: true });
      this.presenter.log("Server stopped", "info");
    }
  }

  private async deleteRemoteLockIfNeeded(request: StopManagedServerRequest): Promise<void> {
    if (!request.isCloudSyncEnabled) {
      return;
    }

    this.presenter.updateTransfer("Removing remote lock...", "Preparing cloud sync...");
    this.presenter.log("Deleting lock from cloud storage...", "info");
    const deleteLockSuccess = await this.dependencies.deleteLock(request.s3Config, request.serverId);

    if (deleteLockSuccess) {
      this.presenter.log("Lock deleted from cloud storage", "info");
      return;
    }

    this.presenter.log("Warning: Failed to delete lock from cloud storage", "warning");
  }

  private async deleteLocalLock(serverId: string, withTransferFeedback: boolean): Promise<void> {
    if (withTransferFeedback) {
      this.presenter.updateTransfer("Removing local lock...", "Preparing cloud sync...");
    }

    const deleteLocalLockSuccess = await this.dependencies.deleteLocalLock(serverId);

    if (deleteLocalLockSuccess) {
      this.presenter.log("Local lock deleted", "info");
      return;
    }

    this.presenter.log("Warning: Failed to delete local lock", "warning");
  }

  private async updateSession(request: StopManagedServerRequest): Promise<boolean> {
    if (request.isCloudSyncEnabled) {
      this.presenter.updateTransfer("Updating session metadata...", "Preparing cloud sync...");
    }

    this.presenter.log("Updating session metadata...", "info");
    const sessionUpdateSuccess = await this.dependencies.updateSession(
      request.serverId,
      request.username,
    );

    if (!sessionUpdateSuccess) {
      this.presenter.log("Warning: Failed to update session metadata", "warning");
    }

    return sessionUpdateSuccess;
  }

  private async uploadServerIfNeeded(
    request: StopManagedServerRequest,
    sessionUpdateSuccess: boolean,
  ): Promise<void> {
    if (!request.isCloudSyncEnabled) {
      return;
    }

    this.presenter.log("Uploading server files to cloud storage...", "info");
    this.presenter.startTransfer("upload");
    const uploadSuccess = await this.dependencies.uploadServer(request.serverId);

    if (!uploadSuccess) {
      this.presenter.log("Warning: Failed to upload server files to R2", "warning");
      return;
    }

    this.presenter.log("Server files uploaded successfully", "info");

    if (!sessionUpdateSuccess) {
      return;
    }

    const sessionUploadSuccess = await this.dependencies.uploadSession(
      request.s3Config,
      request.serverId,
    );

    if (sessionUploadSuccess) {
      this.presenter.log("Session metadata updated successfully", "info");
      return;
    }

    this.presenter.log("Warning: Failed to upload session metadata", "warning");
  }
}
