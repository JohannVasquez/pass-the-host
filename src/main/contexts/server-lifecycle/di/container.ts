import { Container } from "inversify";
import { TYPES } from "@main/contexts/server-lifecycle/application/use-cases/types";
import { IServerLifecycleRepository } from "@main/contexts/server-lifecycle/domain/repositories";
import { ServerLifecycleRepository } from "@main/contexts/server-lifecycle/infrastructure/repositories";
import {
  CreateMinecraftServerUseCase,
  DeleteServerLocallyUseCase,
  GetLocalServerPathUseCase,
  ListLocalServersUseCase,
} from "@main/contexts/server-lifecycle/application/use-cases";

export function configureServerLifecycleContainer(container: Container): void {
  // Repository
  container
    .bind<IServerLifecycleRepository>(TYPES.IServerLifecycleRepository)
    .to(ServerLifecycleRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<CreateMinecraftServerUseCase>(TYPES.CreateMinecraftServerUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IServerLifecycleRepository>(
        TYPES.IServerLifecycleRepository,
      );
      return new CreateMinecraftServerUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<DeleteServerLocallyUseCase>(TYPES.DeleteServerLocallyUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IServerLifecycleRepository>(
        TYPES.IServerLifecycleRepository,
      );
      return new DeleteServerLocallyUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<ListLocalServersUseCase>(TYPES.ListLocalServersUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IServerLifecycleRepository>(
        TYPES.IServerLifecycleRepository,
      );
      return new ListLocalServersUseCase(repository);
    })
    .inTransientScope();

  container
    .bind<GetLocalServerPathUseCase>(TYPES.GetLocalServerPathUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IServerLifecycleRepository>(
        TYPES.IServerLifecycleRepository,
      );
      return new GetLocalServerPathUseCase(repository);
    })
    .inTransientScope();
}
