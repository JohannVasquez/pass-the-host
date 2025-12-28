export interface IServerControlUseCase {
  startServer(): void;
  stopServer(): void;
  releaseServerLock(): void;
  syncFilesToR2(): void;
  editServerProperties(): void;
}
