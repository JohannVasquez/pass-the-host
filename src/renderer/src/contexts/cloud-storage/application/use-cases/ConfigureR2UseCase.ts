import { injectable } from 'inversify';
import type { R2Config } from '../../domain/entities';
import { EventBus } from '@shared/infrastructure/event-bus';
import { R2ConfiguredEvent } from '@shared/domain/DomainEvents';

/**
 * Configure R2 Use Case
 * Validates and saves R2 configuration
 */
@injectable()
export class ConfigureR2UseCase {
  private eventBus = EventBus.getInstance();

  async execute(config: R2Config): Promise<void> {
    // Validate configuration
    if (!config.endpoint || !config.access_key || !config.secret_key || !config.bucket_name) {
      throw new Error('R2 configuration is incomplete');
    }

    // Configuration is valid, publish event
    this.eventBus.publish(
      new R2ConfiguredEvent({
        endpoint: config.endpoint,
        bucket: config.bucket_name,
        region: config.region,
      })
    );
  }
}
