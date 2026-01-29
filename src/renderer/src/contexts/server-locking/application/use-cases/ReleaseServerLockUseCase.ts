import { injectable, inject } from "inversify";
import type { IServerLockRepository } from "@server-locking/domain/repositories";
import type { S3Config } from "@cloud-storage/domain/entities";
import type { LockOperationResult } from "@server-locking/domain/entities";
import { SERVER_LOCKING_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { ServerLockReleasedEvent } from "@shared/domain/DomainEvents";

/**
 * Release Server Lock Use Case
 * Deletes lock from both local and S3-compatible storage
 */
@injectable()
export class ReleaseServerLockUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SERVER_LOCKING_TYPES.ServerLockRepository)
    private repository: IServerLockRepository,
  ) {}

  async execute(s3Config: S3Config, serverId: string): Promise<boolean> {
    if (!serverId) {
      throw new Error("ServerId is required");
    }

    // Delete from both local and remote
    const remoteResult: LockOperationResult = await this.repository.deleteRemoteLock(
      s3Config,
      serverId,
    );
    const localResult: LockOperationResult = await this.repository.deleteLocalLock(serverId);

    const success = remoteResult.success || localResult.success;

    if (success) {
      this.eventBus.publish(
        new ServerLockReleasedEvent({
          serverId,
        }),
      );
    }

    return success;
  }
}
