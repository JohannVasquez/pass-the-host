import { injectable, inject } from "inversify";
import type { IConfigurationRepository } from "../../domain/repositories";
import { APP_CONFIGURATION_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import { LanguageChangedEvent } from "@shared/domain/DomainEvents";

/**
 * Change Language Use Case
 * Changes the application language
 */
@injectable()
export class ChangeLanguageUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    private repository: IConfigurationRepository,
  ) {}

  async execute(language: string): Promise<boolean> {
    if (!language) {
      throw new Error("Language cannot be empty");
    }

    const success = await this.repository.saveLanguage(language);

    if (success) {
      this.eventBus.publish(
        new LanguageChangedEvent({
          language,
        }),
      );
    }

    return success;
  }
}
