import { injectable, inject } from "inversify";
import type { IServerLockRepository } from "@server-locking/domain/repositories";
import type { R2Config } from "@cloud-storage/domain/entities";
import { SERVER_LOCKING_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { ServerLockUploadedEvent } from "@shared/domain/DomainEvents";

/**
 * Upload Server Lock Use Case
 * Uploads local lock file to R2 storage
 */
@injectable()
export class UploadServerLockUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SERVER_LOCKING_TYPES.ServerLockRepository)
    private repository: IServerLockRepository,
  ) {}

  async execute(r2Config: R2Config, serverId: string): Promise<boolean> {
    if (!serverId) {
      throw new Error("ServerId is required");
    }

    const success = await this.repository.uploadLock(r2Config, serverId);

    if (success) {
      this.eventBus.publish(
        new ServerLockUploadedEvent({
          serverId,
        }),
      );
    }

    return success;
  }
}
