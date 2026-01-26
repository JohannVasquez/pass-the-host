import type { Container } from 'inversify';
import { SERVER_LOCKING_TYPES } from '@shared/di';
import type { IServerLockRepository } from '../domain/repositories';
import { ServerLockRepository } from '../infrastructure/repositories';
import {
  CreateServerLockUseCase,
  CheckServerLockUseCase,
  UploadServerLockUseCase,
  ReleaseServerLockUseCase,
} from '../application/use-cases';

/**
 * Configures the Server Locking context in the DI container
 */
export function configureServerLocking(container: Container): void {
  // Repositories
  container
    .bind<IServerLockRepository>(SERVER_LOCKING_TYPES.ServerLockRepository)
    .to(ServerLockRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<CreateServerLockUseCase>(SERVER_LOCKING_TYPES.CreateServerLockUseCase)
    .to(CreateServerLockUseCase)
    .inSingletonScope();

  container
    .bind<CheckServerLockUseCase>(SERVER_LOCKING_TYPES.CheckServerLockUseCase)
    .to(CheckServerLockUseCase)
    .inSingletonScope();

  container
    .bind<UploadServerLockUseCase>(SERVER_LOCKING_TYPES.UploadServerLockUseCase)
    .to(UploadServerLockUseCase)
    .inSingletonScope();

  container
    .bind<ReleaseServerLockUseCase>(SERVER_LOCKING_TYPES.ReleaseServerLockUseCase)
    .to(ReleaseServerLockUseCase)
    .inSingletonScope();
}
