import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "@cloud-storage/domain/repositories";
import type { S3Config } from "@cloud-storage/domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { R2ConnectionTestedEvent } from "@shared/domain/DomainEvents";

/**
 * Test S3 Connection Use Case
 * Tests connectivity to S3-compatible storage with provided configuration
 */
@injectable()
export class TestR2ConnectionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository,
  ) {}

  async execute(config: S3Config): Promise<boolean> {
    const success = await this.repository.testConnection(config);

    this.eventBus.publish(
      new R2ConnectionTestedEvent({
        success,
        endpoint: config.endpoint,
      }),
    );

    return success;
  }
}
