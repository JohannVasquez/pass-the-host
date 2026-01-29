import { injectable, inject } from "inversify";
import type { ISessionRepository } from "@session-tracking/domain/repositories";
import type { S3Config } from "@cloud-storage/domain/entities";
import { SESSION_TRACKING_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { SessionUploadedEvent } from "@shared/domain/DomainEvents";

/**
 * Upload Session Use Case
 * Uploads session data to S3-compatible storage
 */
@injectable()
export class UploadSessionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SESSION_TRACKING_TYPES.SessionRepository)
    private repository: ISessionRepository,
  ) {}

  async execute(s3Config: S3Config, serverId: string): Promise<boolean> {
    if (!serverId) {
      throw new Error("ServerId is required");
    }

    const success = await this.repository.uploadSession(s3Config, serverId);

    if (success) {
      this.eventBus.publish(
        new SessionUploadedEvent({
          serverId,
        }),
      );
    }

    return success;
  }
}
