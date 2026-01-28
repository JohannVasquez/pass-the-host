import { injectable } from "inversify";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import { Server, ServerType } from "@server-lifecycle/domain/entities/Server";

interface RawServerData {
  id?: string;
  name: string;
  version?: string;
  type?: string;
}

/**
 * Server Repository implementation using Electron IPC
 * Communicates with main process to manage servers
 */
@injectable()
export class ServerRepository implements IServerRepository {
  /**
   * Gets all available servers from local and R2 storage
   */
  async getServers(): Promise<Server[]> {
    try {
      const servers = await (
        window as Window & { api?: { r2?: { listServers: () => Promise<RawServerData[]> } } }
      ).api?.r2?.listServers();
      if (!servers) return [];
      return servers.map((server: RawServerData) => this.mapToServer(server));
    } catch (error) {
      console.error("Error getting servers:", error);
      return [];
    }
  }

  /**
   * Gets a specific server by ID
   */
  async getServerById(id: string): Promise<Server | null> {
    try {
      const servers = await this.getServers();
      return servers.find((server) => server.id === id) || null;
    } catch (error) {
      console.error(`Error getting server ${id}:`, error);
      return null;
    }
  }

  /**
   * Creates a new server
   */
  async createServer(name: string, version: string, type: "vanilla" | "forge"): Promise<Server> {
    try {
      const api = (
        window as Window & {
          api?: {
            server?: {
              createServer: (name: string, version: string, type: string) => Promise<void>;
            };
          };
        }
      ).api;
      await api?.server?.createServer(name, version, type);

      return {
        id: name, // Server name is used as ID
        name: name,
        version: version,
        type: type === "vanilla" ? ServerType.VANILLA : ServerType.FORGE,
      };
    } catch (error) {
      console.error("Error creating server:", error);
      throw new Error(`Failed to create server: ${error}`);
    }
  }

  /**
   * Deletes a server
   */
  async deleteServer(serverId: string): Promise<void> {
    try {
      const api = (
        window as Window & { api?: { server?: { deleteServer: (id: string) => Promise<void> } } }
      ).api;
      await api?.server?.deleteServer(serverId);
    } catch (error) {
      console.error(`Error deleting server ${serverId}:`, error);
      throw new Error(`Failed to delete server: ${error}`);
    }
  }

  /**
   * Checks if a server exists locally
   */
  async serverExistsLocally(serverId: string): Promise<boolean> {
    try {
      const api = (
        window as Window & {
          api?: { server?: { existsLocally: (id: string) => Promise<boolean> } };
        }
      ).api;
      const exists = await api?.server?.existsLocally(serverId);
      return exists ?? false;
    } catch (error) {
      console.error(`Error checking if server ${serverId} exists:`, error);
      return false;
    }
  }

  /**
   * Maps raw server data to Server entity
   */
  private mapToServer(data: RawServerData): Server {
    return {
      id: data.id || data.name,
      name: data.name,
      version: data.version || "unknown",
      type: this.parseServerType(data.type || "unknown"),
    };
  }

  /**
   * Parses server type string to ServerType enum
   */
  private parseServerType(type: string): ServerType {
    const normalizedType = type?.toLowerCase() || "";

    switch (normalizedType) {
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
