import { injectable, inject } from "inversify";
import type { IConfigurationRepository } from "../../domain/repositories";
import { APP_CONFIGURATION_TYPES } from "@shared/di";

/**
 * Load Configuration Use Case
 * Loads the complete application configuration
 */
@injectable()
export class LoadConfigurationUseCase {
  constructor(
    @inject(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    private repository: IConfigurationRepository
  ) {}

  async execute(): Promise<any> {
    return await this.repository.loadConfig();
  }
}
