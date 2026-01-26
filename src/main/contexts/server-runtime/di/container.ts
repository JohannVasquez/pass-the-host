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

  // Use Cases - with factory injection
  container.bind<SpawnServerProcessUseCase>(SpawnServerProcessUseCase).toDynamicValue((context) => {
    return new SpawnServerProcessUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<SendCommandUseCase>(SendCommandUseCase).toDynamicValue((context) => {
    return new SendCommandUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<KillServerProcessUseCase>(KillServerProcessUseCase).toDynamicValue((context) => {
    return new KillServerProcessUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<ReadForgeJvmArgsUseCase>(ReadForgeJvmArgsUseCase).toDynamicValue((context) => {
    return new ReadForgeJvmArgsUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<EditForgeJvmArgsUseCase>(EditForgeJvmArgsUseCase).toDynamicValue((context) => {
    return new EditForgeJvmArgsUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });

  container.bind<OpenServerFolderUseCase>(OpenServerFolderUseCase).toDynamicValue((context) => {
    return new OpenServerFolderUseCase(
      context.container.get<IServerProcessRepository>(TYPES.ServerProcessRepository)
    );
  });
}
