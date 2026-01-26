import { injectable } from "inversify";
import type { ICloudStorageRepository } from "../../domain/repositories";
import type { R2Config, RemoteServer, TransferProgress } from "../../domain/entities";

/**
 * Cloud Storage Repository implementation using rclone IPC
 * Communicates with the main process for R2 operations
 */
@injectable()
export class CloudStorageRepository implements ICloudStorageRepository {
  async testConnection(config: R2Config): Promise<boolean> {
    try {
      return await window.rclone.testR2Connection(config);
    } catch (error) {
      console.error("Error testing R2 connection:", error);
      return false;
    }
  }

  async listServers(config: R2Config): Promise<RemoteServer[]> {
    try {
      const servers = await window.rclone.listServers(config);
      return servers.map((server) => ({
        id: server.id,
        name: server.name,
        version: server.version,
        type: server.type,
      }));
    } catch (error) {
      console.error("Error listing servers from R2:", error);
      return [];
    }
  }

  async downloadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean> {
    try {
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
    } catch (error) {
      console.error(`Error downloading server ${serverId}:`, error);
      return false;
    }
  }

  async uploadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean> {
    try {
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
    } catch (error) {
      console.error(`Error uploading server ${serverId}:`, error);
      return false;
    }
  }

  async deleteServer(_config: R2Config, serverId: string): Promise<boolean> {
    try {
      // Note: deleteServerFromR2 not available in current IPC API
      // This would need to be implemented in the main process
      console.warn("Delete server from R2 not yet implemented in IPC API");
      return false;
    } catch (error) {
      console.error(`Error deleting server ${serverId} from R2:`, error);
      return false;
    }
  }
}
