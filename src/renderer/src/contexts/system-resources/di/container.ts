import type { Container } from "inversify";
import { SYSTEM_RESOURCES_TYPES } from "@shared/di";
import type { ISystemResourcesRepository } from "@system-resources/domain/repositories";
import { SystemResourcesRepository } from "@system-resources/infrastructure/repositories";
import {
  GetSystemMemoryUseCase,
  GetNetworkInterfacesUseCase,
} from "@system-resources/application/use-cases";

/**
 * Configures the System Resources context in the DI container
 */
export function configureSystemResources(container: Container): void {
  // Repositories
  container
    .bind<ISystemResourcesRepository>(SYSTEM_RESOURCES_TYPES.SystemResourcesRepository)
    .to(SystemResourcesRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<GetSystemMemoryUseCase>(SYSTEM_RESOURCES_TYPES.GetSystemMemoryUseCase)
    .to(GetSystemMemoryUseCase)
    .inSingletonScope();

  container
    .bind<GetNetworkInterfacesUseCase>(SYSTEM_RESOURCES_TYPES.GetNetworkInterfacesUseCase)
    .to(GetNetworkInterfacesUseCase)
    .inSingletonScope();
}
