import { Container } from 'inversify'
import { SERVER_RUNTIME_TYPES } from '@shared/di/types'
import type { IServerRuntimeRepository } from '@server-runtime/domain/repositories/IServerRuntimeRepository'
import { ServerRuntimeRepository } from '@server-runtime/infrastructure/repositories/ServerRuntimeRepository'
import {
  StartServerUseCase,
  StopServerUseCase,
  ExecuteCommandUseCase,
  GetServerStatusUseCase
} from '@server-runtime/application/use-cases'

/**
 * Configure Server Runtime context dependencies
 */
export function configureServerRuntime(container: Container): void {
  // Repositories
  container
    .bind<IServerRuntimeRepository>(SERVER_RUNTIME_TYPES.ServerRuntimeRepository)
    .to(ServerRuntimeRepository)
    .inSingletonScope()

  // Use Cases
  container
    .bind<StartServerUseCase>(SERVER_RUNTIME_TYPES.StartServerUseCase)
    .to(StartServerUseCase)
    .inSingletonScope()

  container
    .bind<StopServerUseCase>(SERVER_RUNTIME_TYPES.StopServerUseCase)
    .to(StopServerUseCase)
    .inSingletonScope()

  container
    .bind<ExecuteCommandUseCase>(SERVER_RUNTIME_TYPES.ExecuteCommandUseCase)
    .to(ExecuteCommandUseCase)
    .inSingletonScope()

  container
    .bind<GetServerStatusUseCase>(SERVER_RUNTIME_TYPES.GetServerStatusUseCase)
    .to(GetServerStatusUseCase)
    .inSingletonScope()
}
