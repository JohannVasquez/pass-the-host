import { Container } from "inversify";
import { TYPES } from "../application/use-cases/types";
import { ISystemResourcesRepository } from "../domain/repositories";
import { SystemResourcesRepository } from "../infrastructure/repositories";
import {
  EnsureJavaForMinecraftUseCase,
  GetInstalledJavaVersionsUseCase,
  GetRequiredJavaVersionUseCase,
  GetTotalMemoryUseCase,
  GetNetworkInterfacesUseCase,
} from "../application/use-cases";

export function configureSystemResourcesContext(container: Container): void {
  // Repository
  container
    .bind<ISystemResourcesRepository>(TYPES.ISystemResourcesRepository)
    .to(SystemResourcesRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<EnsureJavaForMinecraftUseCase>(TYPES.EnsureJavaForMinecraftUseCase)
    .toDynamicValue(() => {
      const repository = container.get<ISystemResourcesRepository>(
        TYPES.ISystemResourcesRepository
      );
      return new EnsureJavaForMinecraftUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<GetInstalledJavaVersionsUseCase>(TYPES.GetInstalledJavaVersionsUseCase)
    .toDynamicValue(() => {
      const repository = container.get<ISystemResourcesRepository>(
        TYPES.ISystemResourcesRepository
      );
      return new GetInstalledJavaVersionsUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<GetRequiredJavaVersionUseCase>(TYPES.GetRequiredJavaVersionUseCase)
    .toDynamicValue(() => {
      const repository = container.get<ISystemResourcesRepository>(
        TYPES.ISystemResourcesRepository
      );
      return new GetRequiredJavaVersionUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<GetTotalMemoryUseCase>(TYPES.GetTotalMemoryUseCase)
    .toDynamicValue(() => {
      const repository = container.get<ISystemResourcesRepository>(
        TYPES.ISystemResourcesRepository
      );
      return new GetTotalMemoryUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<GetNetworkInterfacesUseCase>(TYPES.GetNetworkInterfacesUseCase)
    .toDynamicValue(() => {
      const repository = container.get<ISystemResourcesRepository>(
        TYPES.ISystemResourcesRepository
      );
      return new GetNetworkInterfacesUseCase(repository);
    })
    .inTransientScope();
}
