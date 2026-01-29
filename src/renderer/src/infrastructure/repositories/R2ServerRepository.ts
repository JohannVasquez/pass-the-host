import { IServerRepository } from "../../domain/repositories/IServerRepository";
import { Server, ServerType } from "../../domain/entities/Server";
import { S3Config } from "../../domain/entities/ServerConfig";

/**
 * S3-compatible Server Repository implementation
 * Communicates with the main process to retrieve servers from S3-compatible storage
 * Supports AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces, etc.
 */
export class R2ServerRepository implements IServerRepository {
  private s3Config: S3Config;

  constructor(s3Config: S3Config) {
    this.s3Config = s3Config;
  }

  /**
   * Gets all servers from S3-compatible storage
   */
  async getServers(): Promise<Server[]> {
    try {
      const rawServers = await window.rclone.listServers(this.s3Config);

      return rawServers.map((server) => ({
        id: server.id,
        name: server.name,
        version: server.version,
        type: this.parseServerType(server.type),
      }));
    } catch (error) {
      console.error("Error getting servers from cloud storage:", error);
      return [];
    }
  }

  /**
   * Gets a specific server by ID
   */
  async getServerById(id: string): Promise<Server | null> {
    const servers = await this.getServers();
    return servers.find((server) => server.id === id) || null;
  }

  /**
   * Parses server type string to ServerType enum
   */
  private parseServerType(type: string): ServerType {
    switch (type.toLowerCase()) {
      case "vanilla":
        return ServerType.VANILLA;
      case "forge":
        return ServerType.FORGE;
      case "paper":
        return ServerType.PAPER;
      case "fabric":
        return ServerType.FABRIC;
      default:
        return ServerType.UNKNOWN;
    }
  }
}
