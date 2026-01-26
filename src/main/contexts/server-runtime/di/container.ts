import { Container } from "inversify";
import { IServerProcessRepository } from "../domain/repositories";
import { ServerProcessRepository } from "../infrastructure/repositories/ServerProcessRepository";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "../application/use-cases";
import { TYPES } from "../application/use-cases/types";

export function configureServerRuntimeContext(container: Container): void {
  // Repositories
  container
    .bind<IServerProcessRepository>(TYPES.ServerProcessRepository)
    .to(ServerProcessRepository)
    .inSingletonScope();

  // Use Cases - with factory injection using closure
  container.bind<SpawnServerProcessUseCase>(SpawnServerProcessUseCase).toDynamicValue(() => {
    return new SpawnServerProcessUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<SendCommandUseCase>(SendCommandUseCase).toDynamicValue(() => {
    return new SendCommandUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<KillServerProcessUseCase>(KillServerProcessUseCase).toDynamicValue(() => {
    return new KillServerProcessUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<ReadForgeJvmArgsUseCase>(ReadForgeJvmArgsUseCase).toDynamicValue(() => {
    return new ReadForgeJvmArgsUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<EditForgeJvmArgsUseCase>(EditForgeJvmArgsUseCase).toDynamicValue(() => {
    return new EditForgeJvmArgsUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<OpenServerFolderUseCase>(OpenServerFolderUseCase).toDynamicValue(() => {
    return new OpenServerFolderUseCase(
      container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });
}
