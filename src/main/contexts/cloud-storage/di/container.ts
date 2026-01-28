import { Container } from "inversify";
import {
  IRcloneRepository,
  IR2ServerRepository,
  IServerLockRepository,
  ISessionRepository,
  IServerPropertiesRepository,
} from "../domain/repositories";
import { RcloneRepository } from "../infrastructure/repositories/RcloneRepository";
import { R2ServerRepository } from "../infrastructure/repositories/R2ServerRepository";
import { ServerLockRepository } from "../infrastructure/repositories/ServerLockRepository";
import { SessionRepository } from "../infrastructure/repositories/SessionRepository";
import { ServerPropertiesRepository } from "../infrastructure/repositories/ServerPropertiesRepository";
import {
  CheckRcloneInstallationUseCase,
  InstallRcloneUseCase,
  TestR2ConnectionUseCase,
  ListR2ServersUseCase,
  DownloadServerFromR2UseCase,
  UploadServerToR2UseCase,
  DeleteServerFromR2UseCase,
  ShouldDownloadServerUseCase,
  CreateServerLockUseCase,
  ReadServerLockUseCase,
  UploadServerLockUseCase,
  DeleteServerLockUseCase,
  DeleteLocalServerLockUseCase,
  CreateSessionUseCase,
  UpdateSessionUseCase,
  UploadSessionUseCase,
  GetServerStatisticsUseCase,
  ReadServerPortUseCase,
  WriteServerPortUseCase,
} from "../application/use-cases";
import { TYPES } from "../application/use-cases/types";

export function configureCloudStorageContext(container: Container): void {
  // Repositories
  container.bind<IRcloneRepository>(TYPES.RcloneRepository).to(RcloneRepository).inSingletonScope();

  container
    .bind<IR2ServerRepository>(TYPES.R2ServerRepository)
    .toDynamicValue(() => {
      const rcloneRepo = container.get<IRcloneRepository>(
        TYPES.RcloneRepository,
      ) as RcloneRepository;
      return new R2ServerRepository(rcloneRepo);
    })
    .inSingletonScope();

  container
    .bind<IServerLockRepository>(TYPES.ServerLockRepository)
    .toDynamicValue(() => {
      const rcloneRepo = container.get<IRcloneRepository>(
        TYPES.RcloneRepository,
      ) as RcloneRepository;
      return new ServerLockRepository(rcloneRepo);
    })
    .inSingletonScope();

  container
    .bind<ISessionRepository>(TYPES.SessionRepository)
    .toDynamicValue(() => {
      const rcloneRepo = container.get<IRcloneRepository>(
        TYPES.RcloneRepository,
      ) as RcloneRepository;
      return new SessionRepository(rcloneRepo);
    })
    .inSingletonScope();

  container
    .bind<IServerPropertiesRepository>(TYPES.ServerPropertiesRepository)
    .to(ServerPropertiesRepository)
    .inSingletonScope();

  // Use Cases - with factory injection
  container
    .bind<CheckRcloneInstallationUseCase>(CheckRcloneInstallationUseCase)
    .toDynamicValue(() => {
      return new CheckRcloneInstallationUseCase(
        container.get<IRcloneRepository>(TYPES.RcloneRepository),
      );
    });

  container.bind<InstallRcloneUseCase>(InstallRcloneUseCase).toDynamicValue(() => {
    return new InstallRcloneUseCase(container.get<IRcloneRepository>(TYPES.RcloneRepository));
  });

  container.bind<TestR2ConnectionUseCase>(TestR2ConnectionUseCase).toDynamicValue(() => {
    return new TestR2ConnectionUseCase(container.get<IRcloneRepository>(TYPES.RcloneRepository));
  });

  container.bind<ListR2ServersUseCase>(ListR2ServersUseCase).toDynamicValue(() => {
    return new ListR2ServersUseCase(container.get<IR2ServerRepository>(TYPES.R2ServerRepository));
  });

  container.bind<DownloadServerFromR2UseCase>(DownloadServerFromR2UseCase).toDynamicValue(() => {
    return new DownloadServerFromR2UseCase(
      container.get<IR2ServerRepository>(TYPES.R2ServerRepository),
    );
  });

  container.bind<UploadServerToR2UseCase>(UploadServerToR2UseCase).toDynamicValue(() => {
    return new UploadServerToR2UseCase(
      container.get<IR2ServerRepository>(TYPES.R2ServerRepository),
    );
  });

  container.bind<DeleteServerFromR2UseCase>(DeleteServerFromR2UseCase).toDynamicValue(() => {
    return new DeleteServerFromR2UseCase(
      container.get<IR2ServerRepository>(TYPES.R2ServerRepository),
    );
  });

  container.bind<ShouldDownloadServerUseCase>(ShouldDownloadServerUseCase).toDynamicValue(() => {
    return new ShouldDownloadServerUseCase(
      container.get<IR2ServerRepository>(TYPES.R2ServerRepository),
    );
  });

  container.bind<CreateServerLockUseCase>(CreateServerLockUseCase).toDynamicValue(() => {
    return new CreateServerLockUseCase(
      container.get<IServerLockRepository>(TYPES.ServerLockRepository),
    );
  });

  container.bind<ReadServerLockUseCase>(ReadServerLockUseCase).toDynamicValue(() => {
    return new ReadServerLockUseCase(
      container.get<IServerLockRepository>(TYPES.ServerLockRepository),
    );
  });

  container.bind<UploadServerLockUseCase>(UploadServerLockUseCase).toDynamicValue(() => {
    return new UploadServerLockUseCase(
      container.get<IServerLockRepository>(TYPES.ServerLockRepository),
    );
  });

  container.bind<DeleteServerLockUseCase>(DeleteServerLockUseCase).toDynamicValue(() => {
    return new DeleteServerLockUseCase(
      container.get<IServerLockRepository>(TYPES.ServerLockRepository),
    );
  });

  container.bind<DeleteLocalServerLockUseCase>(DeleteLocalServerLockUseCase).toDynamicValue(() => {
    return new DeleteLocalServerLockUseCase(
      container.get<IServerLockRepository>(TYPES.ServerLockRepository),
    );
  });

  container.bind<CreateSessionUseCase>(CreateSessionUseCase).toDynamicValue(() => {
    return new CreateSessionUseCase(container.get<ISessionRepository>(TYPES.SessionRepository));
  });

  container.bind<UpdateSessionUseCase>(UpdateSessionUseCase).toDynamicValue(() => {
    return new UpdateSessionUseCase(container.get<ISessionRepository>(TYPES.SessionRepository));
  });

  container.bind<UploadSessionUseCase>(UploadSessionUseCase).toDynamicValue(() => {
    return new UploadSessionUseCase(container.get<ISessionRepository>(TYPES.SessionRepository));
  });

  container.bind<GetServerStatisticsUseCase>(GetServerStatisticsUseCase).toDynamicValue(() => {
    return new GetServerStatisticsUseCase(
      container.get<ISessionRepository>(TYPES.SessionRepository),
    );
  });

  container.bind<ReadServerPortUseCase>(ReadServerPortUseCase).toDynamicValue(() => {
    return new ReadServerPortUseCase(
      container.get<IServerPropertiesRepository>(TYPES.ServerPropertiesRepository),
    );
  });

  container.bind<WriteServerPortUseCase>(WriteServerPortUseCase).toDynamicValue(() => {
    return new WriteServerPortUseCase(
      container.get<IServerPropertiesRepository>(TYPES.ServerPropertiesRepository),
    );
  });
}
