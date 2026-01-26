import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "../../domain/repositories";
import type { R2Config } from "../../domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { ServerDeletedFromR2Event } from "@shared/domain/DomainEvents";

/**
 * Delete Remote Server Use Case
 * Deletes a server from R2 storage
 */
@injectable()
export class DeleteRemoteServerUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository
  ) {}

  async execute(config: R2Config, serverId: string): Promise<boolean> {
    const success = await this.repository.deleteServer(config, serverId);

    if (success) {
      this.eventBus.publish(new ServerDeletedFromR2Event({ serverId }));
    }

    return success;
  }
}
