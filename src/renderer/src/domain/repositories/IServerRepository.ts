import { Server } from "../entities/Server";

/**
 * Server Repository interface
 */
export interface IServerRepository {
  /**
   * Gets all servers from R2 storage
   * @returns Promise with array of servers
   */
  getServers(): Promise<Server[]>;

  /**
   * Gets a specific server by ID
   * @param id Server ID
   * @returns Promise with server or null if not found
   */
  getServerById(id: string): Promise<Server | null>;
}
