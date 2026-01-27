import type { Container } from "inversify";
import { APP_CONFIGURATION_TYPES } from "@shared/di";
import type { IConfigurationRepository } from "../domain/repositories";
import { ConfigurationRepository } from "../infrastructure/repositories";
import {
  LoadConfigurationUseCase,
  SaveUsernameUseCase,
  ChangeLanguageUseCase,
  SaveRamConfigUseCase,
} from "../application/use-cases";

/**
 * Configures the App Configuration context in the DI container
 */
export function configureAppConfiguration(container: Container): void {
  // Repositories
  container
    .bind<IConfigurationRepository>(APP_CONFIGURATION_TYPES.ConfigurationRepository)
    .to(ConfigurationRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<LoadConfigurationUseCase>(APP_CONFIGURATION_TYPES.LoadConfigurationUseCase)
    .to(LoadConfigurationUseCase)
    .inSingletonScope();

  container
    .bind<SaveUsernameUseCase>(APP_CONFIGURATION_TYPES.SaveUsernameUseCase)
    .to(SaveUsernameUseCase)
    .inSingletonScope();

  container
    .bind<ChangeLanguageUseCase>(APP_CONFIGURATION_TYPES.ChangeLanguageUseCase)
    .to(ChangeLanguageUseCase)
    .inSingletonScope();

  container
    .bind<SaveRamConfigUseCase>(APP_CONFIGURATION_TYPES.SaveRamConfigUseCase)
    .to(SaveRamConfigUseCase)
    .inSingletonScope();
}
