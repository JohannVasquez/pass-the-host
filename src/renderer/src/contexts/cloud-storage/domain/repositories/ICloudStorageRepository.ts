import type { R2Config, RemoteServer, TransferProgress } from '../entities';

/**
 * Cloud Storage Repository interface
 * Defines operations for R2 cloud storage
 */
export interface ICloudStorageRepository {
  /**
   * Tests connection to R2 storage
   */
  testConnection(config: R2Config): Promise<boolean>;

  /**
   * Lists all servers available in R2 storage
   */
  listServers(config: R2Config): Promise<RemoteServer[]>;

  /**
   * Downloads a server from R2 to local storage
   */
  downloadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean>;

  /**
   * Uploads a server from local storage to R2
   */
  uploadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean>;

  /**
   * Deletes a server from R2 storage
   */
  deleteServer(config: R2Config, serverId: string): Promise<boolean>;
}
