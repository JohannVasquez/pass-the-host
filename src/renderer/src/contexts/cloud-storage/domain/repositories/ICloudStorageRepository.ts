import type { S3Config, RemoteServer, TransferProgress } from "../entities";

/**
 * Cloud Storage Repository interface
 * Defines operations for S3-compatible cloud storage
 */
export interface ICloudStorageRepository {
  /**
   * Tests connection to S3-compatible storage
   */
  testConnection(config: S3Config): Promise<boolean>;

  /**
   * Lists all servers available in S3-compatible storage
   */
  listServers(config: S3Config): Promise<RemoteServer[]>;

  /**
   * Downloads a server from S3-compatible storage to local storage
   */
  downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean>;

  /**
   * Uploads a server from local storage to S3-compatible storage
   */
  uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean>;

  /**
   * Deletes a server from S3-compatible storage
   */
  deleteServer(config: S3Config, serverId: string): Promise<boolean>;
}
