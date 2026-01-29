import { injectable } from "inversify";
import type { S3Config } from "@cloud-storage/domain/entities";
import { EventBus } from "@shared/infrastructure/event-bus";
import { R2ConfiguredEvent } from "@shared/domain/DomainEvents";

/**
 * Configure S3 Use Case
 * Validates and saves S3-compatible storage configuration
 */
@injectable()
export class ConfigureR2UseCase {
  private eventBus = EventBus.getInstance();

  async execute(config: S3Config): Promise<void> {
    // Validate configuration
    if (!config.endpoint || !config.access_key || !config.secret_key || !config.bucket_name) {
      throw new Error("S3 configuration is incomplete");
    }

    // Configuration is valid, publish event
    this.eventBus.publish(
      new R2ConfiguredEvent({
        endpoint: config.endpoint,
        bucket: config.bucket_name,
        region: config.region,
      }),
    );
  }
}
