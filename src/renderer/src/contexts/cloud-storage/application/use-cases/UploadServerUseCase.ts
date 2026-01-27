import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "../../domain/repositories";
import type { R2Config, TransferProgress } from "../../domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import {
  ServerUploadStartedEvent,
  ServerUploadProgressEvent,
  ServerUploadCompletedEvent,
  ServerUploadFailedEvent,
} from "@shared/domain/DomainEvents";

/**
 * Upload Server Use Case
 * Uploads a server from local storage to R2
 */
@injectable()
export class UploadServerUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository
  ) {}

  async execute(config: R2Config, serverId: string): Promise<boolean> {
    this.eventBus.publish(new ServerUploadStartedEvent({ serverId }));

    try {
      const success = await this.repository.uploadServer(
        config,
        serverId,
        (progress: TransferProgress) => {
          this.eventBus.publish(
            new ServerUploadProgressEvent({
              serverId,
              progress: progress.percentage,
              bytesTransferred: progress.bytesTransferred,
              totalBytes: progress.totalBytes,
            })
          );
        }
      );

      if (success) {
        this.eventBus.publish(new ServerUploadCompletedEvent({ serverId }));
      } else {
        this.eventBus.publish(
          new ServerUploadFailedEvent({
            serverId,
            error: "Upload failed",
          })
        );
      }

      return success;
    } catch (error) {
      this.eventBus.publish(
        new ServerUploadFailedEvent({
          serverId,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
      return false;
    }
  }
}
