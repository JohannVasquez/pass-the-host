import { R2Config } from "../../domain/entities/ServerConfig";

/**
 * R2 Service - Handles all R2 storage operations
 * Following Clean Architecture principles
 */
export class R2Service {
  private r2Config: R2Config;

  constructor(r2Config: R2Config) {
    this.r2Config = r2Config;
  }

  /**
   * Downloads a server from R2 to local storage
   * Deletes existing files before downloading
   */
  async downloadServer(serverId: string): Promise<boolean> {
    try {
      return await window.rclone.downloadServer(this.r2Config, serverId);
    } catch (error) {
      console.error(`Error downloading server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Uploads a server from local storage to R2
   */
  async uploadServer(serverId: string): Promise<boolean> {
    try {
      return await window.rclone.uploadServer(this.r2Config, serverId);
    } catch (error) {
      console.error(`Error uploading server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Tests the R2 connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await window.rclone.testR2Connection(this.r2Config);
    } catch (error) {
      console.error("Error testing R2 connection:", error);
      return false;
    }
  }

  /**
   * Lists all servers in R2
   */
  async listServers(): Promise<Array<{ id: string; name: string; version: string; type: string }>> {
    try {
      return await window.rclone.listServers(this.r2Config);
    } catch (error) {
      console.error("Error listing servers:", error);
      return [];
    }
  }

  /**
   * Updates the R2 configuration
   */
  updateConfig(config: R2Config): void {
    this.r2Config = config;
  }
}
