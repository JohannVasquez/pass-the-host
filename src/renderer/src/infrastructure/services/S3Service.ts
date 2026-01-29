import { S3Config } from "../../domain/entities/ServerConfig";

/**
 * S3 Service - Handles all S3-compatible storage operations
 * Supports AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces, etc.
 * Following Clean Architecture principles
 */
export class S3Service {
  private s3Config: S3Config;

  constructor(s3Config: S3Config) {
    this.s3Config = s3Config;
  }

  /**
   * Downloads a server from cloud storage to local storage
   * Deletes existing files before downloading
   */
  async downloadServer(serverId: string): Promise<boolean> {
    try {
      return await window.rclone.downloadServer(this.s3Config, serverId);
    } catch (error) {
      console.error(`Error downloading server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Uploads a server from local storage to cloud storage
   */
  async uploadServer(serverId: string): Promise<boolean> {
    try {
      return await window.rclone.uploadServer(this.s3Config, serverId);
    } catch (error) {
      console.error(`Error uploading server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Tests the cloud storage connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await window.rclone.testConnection(this.s3Config);
    } catch (error) {
      console.error("Error testing cloud storage connection:", error);
      return false;
    }
  }

  /**
   * Lists all servers in cloud storage
   */
  async listServers(): Promise<Array<{ id: string; name: string; version: string; type: string }>> {
    try {
      return await window.rclone.listServers(this.s3Config);
    } catch (error) {
      console.error("Error listing servers:", error);
      return [];
    }
  }

  /**
   * Updates the S3 configuration
   */
  updateConfig(config: S3Config): void {
    this.s3Config = config;
  }
}
