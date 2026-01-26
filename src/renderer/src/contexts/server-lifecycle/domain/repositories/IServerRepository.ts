import { Server } from "../entities/Server";

/**
 * Server Repository interface
 * Defines operations for server persistence and retrieval
 */
export interface IServerRepository {
  /**
   * Gets all available servers
   * @returns Promise with array of servers
   */
  getServers(): Promise<Server[]>;

  /**
   * Gets a specific server by ID
   * @param id Server ID
   * @returns Promise with server or null if not found
   */
  getServerById(id: string): Promise<Server | null>;

  /**
   * Creates a new server
   * @param name Server name
   * @param version Minecraft version
   * @param type Server type (vanilla or forge)
   * @returns Promise with created server
   */
  createServer(name: string, version: string, type: "vanilla" | "forge"): Promise<Server>;

  /**
   * Deletes a server
   * @param serverId Server ID to delete
   * @returns Promise that resolves when server is deleted
   */
  deleteServer(serverId: string): Promise<void>;

  /**
   * Checks if a server exists locally
   * @param serverId Server ID
   * @returns Promise with boolean indicating if server exists
   */
  serverExistsLocally(serverId: string): Promise<boolean>;
}
