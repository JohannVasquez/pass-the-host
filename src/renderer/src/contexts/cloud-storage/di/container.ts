import type { Container } from 'inversify';
import { CLOUD_STORAGE_TYPES } from '@shared/di';
import type { ICloudStorageRepository } from '../domain/repositories';
import { CloudStorageRepository } from '../infrastructure/repositories';
import {
  ConfigureR2UseCase,
  TestR2ConnectionUseCase,
  ListRemoteServersUseCase,
  DownloadServerUseCase,
  UploadServerUseCase,
  DeleteRemoteServerUseCase,
} from '../application/use-cases';

/**
 * Configures the Cloud Storage context in the DI container
 */
export function configureCloudStorage(container: Container): void {
  // Repositories
  container
    .bind<ICloudStorageRepository>(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    .to(CloudStorageRepository)
    .inSingletonScope();

  // Use Cases
  container
    .bind<ConfigureR2UseCase>(CLOUD_STORAGE_TYPES.ConfigureR2UseCase)
    .to(ConfigureR2UseCase)
    .inSingletonScope();

  container
    .bind<TestR2ConnectionUseCase>(CLOUD_STORAGE_TYPES.TestR2ConnectionUseCase)
    .to(TestR2ConnectionUseCase)
    .inSingletonScope();

  container
    .bind<ListRemoteServersUseCase>(CLOUD_STORAGE_TYPES.ListRemoteServersUseCase)
    .to(ListRemoteServersUseCase)
    .inSingletonScope();

  container
    .bind<DownloadServerUseCase>(CLOUD_STORAGE_TYPES.DownloadServerUseCase)
    .to(DownloadServerUseCase)
    .inSingletonScope();

  container
    .bind<UploadServerUseCase>(CLOUD_STORAGE_TYPES.UploadServerUseCase)
    .to(UploadServerUseCase)
    .inSingletonScope();

  container
    .bind<DeleteRemoteServerUseCase>(CLOUD_STORAGE_TYPES.DeleteRemoteServerUseCase)
    .to(DeleteRemoteServerUseCase)
    .inSingletonScope();
}
