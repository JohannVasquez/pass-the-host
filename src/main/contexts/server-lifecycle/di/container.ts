import { Container } from "inversify";
import { TYPES } from "../application/use-cases/types";
import { IServerLifecycleRepository } from "../domain/repositories";
import { ServerLifecycleRepository } from "../infrastructure/repositories";
import {
  CreateMinecraftServerUseCase,
  DeleteServerLocallyUseCase,
  GetLocalServerPathUseCase,
} from "../application/use-cases";

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
    .bind<GetLocalServerPathUseCase>(TYPES.GetLocalServerPathUseCase)
    .toDynamicValue(() => {
      const repository = container.get<IServerLifecycleRepository>(
        TYPES.IServerLifecycleRepository,
      );
      return new GetLocalServerPathUseCase(repository);
    })
    .inTransientScope();
}
