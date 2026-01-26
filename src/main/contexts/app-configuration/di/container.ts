import { Container } from "inversify";
import { TYPES } from "../application/use-cases/types";
import { IAppConfigurationRepository } from "../domain/repositories";
import { AppConfigurationRepository } from "../infrastructure/repositories";
import {
  LoadConfigUseCase,
  SaveR2ConfigUseCase,
  SaveUsernameUseCase,
  SaveRamConfigUseCase,
  SaveLanguageUseCase,
} from "../application/use-cases";

export function configureAppConfigurationContext(container: Container): void {
  // Repository
  container
    .bind<IAppConfigurationRepository>(TYPES.IAppConfigurationRepository)
    .to(AppConfigurationRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<LoadConfigUseCase>(TYPES.LoadConfigUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository
      );
      return new LoadConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveR2ConfigUseCase>(TYPES.SaveR2ConfigUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository
      );
      return new SaveR2ConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveUsernameUseCase>(TYPES.SaveUsernameUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository
      );
      return new SaveUsernameUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveRamConfigUseCase>(TYPES.SaveRamConfigUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository
      );
      return new SaveRamConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveLanguageUseCase>(TYPES.SaveLanguageUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository
      );
      return new SaveLanguageUseCase(repository);
    })
    .inTransientScope();
}
