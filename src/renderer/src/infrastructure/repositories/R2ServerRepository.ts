import { IServerRepository } from "../../domain/repositories/IServerRepository";
import { Server, ServerType } from "../../domain/entities/Server";

/**
 * R2 Server Repository implementation
 * Communicates with the main process to retrieve servers from R2 storage
 */
export class R2ServerRepository implements IServerRepository {
  private r2Config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  };

  constructor(r2Config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  }) {
    this.r2Config = r2Config;
  }

  /**
   * Gets all servers from R2 storage
   */
  async getServers(): Promise<Server[]> {
    try {
      const rawServers = await window.rclone.listServers(this.r2Config);

      return rawServers.map((server) => ({
        id: server.id,
        name: server.name,
        version: server.version,
        type: this.parseServerType(server.type),
      }));
    } catch (error) {
      console.error("Error getting servers from R2:", error);
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
