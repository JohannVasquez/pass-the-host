import { Container } from "inversify";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import { ServerRepository } from "@server-lifecycle/infrastructure/repositories/ServerRepository";
import {
  CreateServerUseCase,
  DeleteServerUseCase,
  ListServersUseCase,
  GetServerDetailsUseCase,
} from "@server-lifecycle/application/use-cases";

/**
 * Configure Server Lifecycle context dependencies
 */
export function configureServerLifecycle(container: Container): void {
  // Repositories
  container
    .bind<IServerRepository>(SERVER_LIFECYCLE_TYPES.ServerRepository)
    .to(ServerRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<CreateServerUseCase>(SERVER_LIFECYCLE_TYPES.CreateServerUseCase)
    .to(CreateServerUseCase)
    .inSingletonScope();

  container
    .bind<DeleteServerUseCase>(SERVER_LIFECYCLE_TYPES.DeleteServerUseCase)
    .to(DeleteServerUseCase)
    .inSingletonScope();

  container
    .bind<ListServersUseCase>(SERVER_LIFECYCLE_TYPES.ListServersUseCase)
    .to(ListServersUseCase)
    .inSingletonScope();

  container
    .bind<GetServerDetailsUseCase>(SERVER_LIFECYCLE_TYPES.GetServerDetailsUseCase)
    .to(GetServerDetailsUseCase)
    .inSingletonScope();
}
