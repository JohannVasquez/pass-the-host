import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "@cloud-storage/domain/repositories";
import type { S3Config, RemoteServer } from "@cloud-storage/domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";

/**
 * List Remote Servers Use Case
 * Retrieves list of servers from S3-compatible storage
 */
@injectable()
export class ListRemoteServersUseCase {
  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository,
  ) {}

  async execute(config: S3Config): Promise<RemoteServer[]> {
    return await this.repository.listServers(config);
  }
}
