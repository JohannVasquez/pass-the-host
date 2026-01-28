import { injectable, inject } from "inversify";
import type { IConfigurationRepository } from "@app-configuration/domain/repositories";
import type { AppConfig } from "@app-configuration/domain/entities";
import { APP_CONFIGURATION_TYPES } from "@shared/di";

/**
 * Load Configuration Use Case
 * Loads the complete application configuration
 */
@injectable()
export class LoadConfigurationUseCase {
  constructor(
    @inject(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    private repository: IConfigurationRepository,
  ) {}

  async execute(): Promise<AppConfig | null> {
    return await this.repository.loadConfig();
  }
}
