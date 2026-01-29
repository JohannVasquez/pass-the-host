import { injectable } from "inversify";
import type { ICloudStorageRepository } from "@cloud-storage/domain/repositories";
import type { S3Config, RemoteServer, TransferProgress } from "@cloud-storage/domain/entities";

/**
 * Cloud Storage Repository implementation using rclone IPC
 * Communicates with the main process for S3-compatible storage operations
 */
@injectable()
export class CloudStorageRepository implements ICloudStorageRepository {
  async testConnection(config: S3Config): Promise<boolean> {
    return await window.rclone.testConnection(config);
  }

  async listServers(config: S3Config): Promise<RemoteServer[]> {
    const servers = await window.rclone.listServers(config);
    return servers.map((server) => ({
      id: server.id,
      name: server.name,
      version: server.version,
      type: server.type,
    }));
  }

  async downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    // Setup progress listener if callback provided
    let cleanup: (() => void) | undefined;
    if (onProgress) {
      cleanup = window.rclone.onTransferProgress((data) => {
        // Convert rclone progress format to our format
        onProgress({
          serverId,
          bytesTransferred: 0, // rclone provides percent, not bytes
          totalBytes: 0,
          percentage: data.percent,
        });
      });
    }

    const result = await window.rclone.downloadServer(config, serverId);

    if (cleanup) cleanup();
    return result;
  }

  async uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    // Setup progress listener if callback provided
    let cleanup: (() => void) | undefined;
    if (onProgress) {
      cleanup = window.rclone.onTransferProgress((data) => {
        // Convert rclone progress format to our format
        onProgress({
          serverId,
          bytesTransferred: 0, // rclone provides percent, not bytes
          totalBytes: 0,
          percentage: data.percent,
        });
      });
    }

    const result = await window.rclone.uploadServer(config, serverId);

    if (cleanup) cleanup();
    return result;
  }

  async deleteServer(_config: S3Config, _serverId: string): Promise<boolean> {
    // Note: deleteServerFromR2 not available in current IPC API
    // This would need to be implemented in the main process
    console.warn("Delete server from cloud storage not yet implemented in IPC API");
    return false;
  }
}
