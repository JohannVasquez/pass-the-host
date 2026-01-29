import { injectable } from "inversify";
import type { ICloudStorageRepository } from "@cloud-storage/domain/repositories";
import type { R2Config, RemoteServer, TransferProgress } from "@cloud-storage/domain/entities";

/**
 * Cloud Storage Repository implementation using rclone IPC
 * Communicates with the main process for R2 operations
 */
@injectable()
export class CloudStorageRepository implements ICloudStorageRepository {
  async testConnection(config: R2Config): Promise<boolean> {
    return await window.rclone.testR2Connection(config);
  }

  async listServers(config: R2Config): Promise<RemoteServer[]> {
    const servers = await window.rclone.listServers(config);
    return servers.map((server) => ({
      id: server.id,
      name: server.name,
      version: server.version,
      type: server.type,
    }));
  }

  async downloadServer(
    config: R2Config,
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
    config: R2Config,
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

  async deleteServer(_config: R2Config, _serverId: string): Promise<boolean> {
    // Note: deleteServerFromR2 not available in current IPC API
    // This would need to be implemented in the main process
    console.warn("Delete server from R2 not yet implemented in IPC API");
    return false;
  }
}
