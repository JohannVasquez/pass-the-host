import { Container } from "inversify";
import { TYPES } from "../application/use-cases/types";
import { IAppConfigurationRepository } from "../domain/repositories";
import { AppConfigurationRepository } from "../infrastructure/repositories";
import {
  LoadConfigUseCase,
  SaveS3ConfigUseCase,
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
        TYPES.IAppConfigurationRepository,
      );
      return new LoadConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveS3ConfigUseCase>(TYPES.SaveS3ConfigUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository,
      );
      return new SaveS3ConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveUsernameUseCase>(TYPES.SaveUsernameUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository,
      );
      return new SaveUsernameUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveRamConfigUseCase>(TYPES.SaveRamConfigUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository,
      );
      return new SaveRamConfigUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<SaveLanguageUseCase>(TYPES.SaveLanguageUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IAppConfigurationRepository>(
        TYPES.IAppConfigurationRepository,
      );
      return new SaveLanguageUseCase(repository);
    })
    .inTransientScope();
}
