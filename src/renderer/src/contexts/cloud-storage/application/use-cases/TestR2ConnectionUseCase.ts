import { injectable, inject } from 'inversify';
import type { ICloudStorageRepository } from '../../domain/repositories';
import type { R2Config } from '../../domain/entities';
import { CLOUD_STORAGE_TYPES } from '@shared/di';
import { EventBus } from '@shared/infrastructure/event-bus';
import { R2ConnectionTestedEvent } from '@shared/domain/DomainEvents';

/**
 * Test R2 Connection Use Case
 * Tests connectivity to R2 storage with provided configuration
 */
@injectable()
export class TestR2ConnectionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository
  ) {}

  async execute(config: R2Config): Promise<boolean> {
    const success = await this.repository.testConnection(config);

    this.eventBus.publish(
      new R2ConnectionTestedEvent({
        success,
        endpoint: config.endpoint,
      })
    );

    return success;
  }
}
