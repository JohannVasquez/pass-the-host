import { injectable, inject } from "inversify";
import type { ICloudStorageRepository } from "../../domain/repositories";
import type { R2Config, RemoteServer } from "../../domain/entities";
import { CLOUD_STORAGE_TYPES } from "@shared/di";

/**
 * List Remote Servers Use Case
 * Retrieves list of servers from R2 storage
 */
@injectable()
export class ListRemoteServersUseCase {
  constructor(
    @inject(CLOUD_STORAGE_TYPES.CloudStorageRepository)
    private repository: ICloudStorageRepository,
  ) {}

  async execute(config: R2Config): Promise<RemoteServer[]> {
    return await this.repository.listServers(config);
  }
}
