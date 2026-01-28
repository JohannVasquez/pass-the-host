import { injectable, inject } from "inversify";
import type { IServerLockRepository } from "../../domain/repositories";
import { SERVER_LOCKING_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { ServerLockCreatedEvent } from "@shared/domain/DomainEvents";

/**
 * Create Server Lock Use Case
 * Creates a lock file for a server to prevent concurrent modifications
 */
@injectable()
export class CreateServerLockUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SERVER_LOCKING_TYPES.ServerLockRepository)
    private repository: IServerLockRepository,
  ) {}

  async execute(serverId: string, username: string): Promise<boolean> {
    if (!serverId || !username) {
      throw new Error("ServerId and username are required");
    }

    const success = await this.repository.createLocalLock(serverId, username);

    if (success) {
      this.eventBus.publish(
        new ServerLockCreatedEvent({
          serverId,
          username,
        }),
      );
    }

    return success;
  }
}
