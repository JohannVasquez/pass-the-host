import { injectable, inject } from "inversify";
import type { IConfigurationRepository } from "@app-configuration/domain/repositories";
import { APP_CONFIGURATION_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { RamConfigChangedEvent } from "@shared/domain/DomainEvents";

/**
 * Save RAM Configuration Use Case
 * Saves the RAM configuration for servers
 */
@injectable()
export class SaveRamConfigUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    private repository: IConfigurationRepository,
  ) {}

  async execute(minRam: number, maxRam: number): Promise<boolean> {
    if (minRam < 0 || maxRam < 0) {
      throw new Error("RAM values cannot be negative");
    }

    if (minRam > maxRam) {
      throw new Error("Minimum RAM cannot be greater than maximum RAM");
    }

    const success = await this.repository.saveRamConfig(minRam, maxRam);

    if (success) {
      this.eventBus.publish(
        new RamConfigChangedEvent({
          minRam,
          maxRam,
        }),
      );
    }

    return success;
  }
}
