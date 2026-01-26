import type { Container } from "inversify";
import { SESSION_TRACKING_TYPES } from "@shared/di";
import type { ISessionRepository } from "../domain/repositories";
import { SessionRepository } from "../infrastructure/repositories";
import {
  CreateSessionUseCase,
  EndSessionUseCase,
  UploadSessionUseCase,
  GetServerStatisticsUseCase,
} from "../application/use-cases";

/**
 * Configures the Session Tracking context in the DI container
 */
export function configureSessionTracking(container: Container): void {
  // Repositories
  container
    .bind<ISessionRepository>(SESSION_TRACKING_TYPES.SessionRepository)
    .to(SessionRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<CreateSessionUseCase>(SESSION_TRACKING_TYPES.CreateSessionUseCase)
    .to(CreateSessionUseCase)
    .inSingletonScope();

  container
    .bind<EndSessionUseCase>(SESSION_TRACKING_TYPES.EndSessionUseCase)
    .to(EndSessionUseCase)
    .inSingletonScope();

  container
    .bind<UploadSessionUseCase>(SESSION_TRACKING_TYPES.UploadSessionUseCase)
    .to(UploadSessionUseCase)
    .inSingletonScope();

  container
    .bind<GetServerStatisticsUseCase>(SESSION_TRACKING_TYPES.GetServerStatisticsUseCase)
    .to(GetServerStatisticsUseCase)
    .inSingletonScope();
}
