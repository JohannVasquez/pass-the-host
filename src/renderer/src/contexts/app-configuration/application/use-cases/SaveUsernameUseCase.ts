import { injectable, inject } from "inversify";
import type { IConfigurationRepository } from "../../domain/repositories";
import { APP_CONFIGURATION_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { UsernameChangedEvent } from "@shared/domain/DomainEvents";

/**
 * Save Username Use Case
 * Saves the username configuration
 */
@injectable()
export class SaveUsernameUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    private repository: IConfigurationRepository,
  ) {}

  async execute(username: string): Promise<boolean> {
    if (!username || username.trim() === "") {
      throw new Error("Username cannot be empty");
    }

    const success = await this.repository.saveUsername(username);

    if (success) {
      this.eventBus.publish(
        new UsernameChangedEvent({
          username,
        }),
      );
    }

    return success;
  }
}
