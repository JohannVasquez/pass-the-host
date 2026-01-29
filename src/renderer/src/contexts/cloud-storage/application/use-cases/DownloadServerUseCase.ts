import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "@cloud-storage/domain/repositories";
import type { S3Config, TransferProgress } from "@cloud-storage/domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import {
  ServerDownloadStartedEvent,
  ServerDownloadProgressEvent,
  ServerDownloadCompletedEvent,
  ServerDownloadFailedEvent,
} from "@shared/domain/DomainEvents";

/**
 * Download Server Use Case
 * Downloads a server from S3-compatible storage to local storage
 */
@injectable()
export class DownloadServerUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository,
  ) {}

  async execute(config: S3Config, serverId: string): Promise<boolean> {
    this.eventBus.publish(new ServerDownloadStartedEvent({ serverId }));

    try {
      const success = await this.repository.downloadServer(
        config,
        serverId,
        (progress: TransferProgress) => {
          this.eventBus.publish(
            new ServerDownloadProgressEvent({
              serverId,
              progress: progress.percentage,
              bytesTransferred: progress.bytesTransferred,
              totalBytes: progress.totalBytes,
            }),
          );
        },
      );

      if (success) {
        this.eventBus.publish(new ServerDownloadCompletedEvent({ serverId }));
      } else {
        this.eventBus.publish(
          new ServerDownloadFailedEvent({
            serverId,
            error: "Download failed",
          }),
        );
      }

      return success;
    } catch (error) {
      this.eventBus.publish(
        new ServerDownloadFailedEvent({
          serverId,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return false;
    }
  }
}
