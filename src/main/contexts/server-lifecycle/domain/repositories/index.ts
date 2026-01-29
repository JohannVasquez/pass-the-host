import { MinecraftServerConfig, ServerCreationResult, ServerDeletionResult } from "../entities";

export interface IServerLifecycleRepository {
  /**
   * Creates a new Minecraft server
   * @param config Server configuration (name, version, type)
   * @param onProgress Progress callback
   * @returns Result with success status
   */
  createServer(
    config: MinecraftServerConfig,
    onProgress?: (message: string) => void,
  ): Promise<ServerCreationResult>;

  /**
   * Deletes a server from local storage
   * @param serverId Server identifier
   * @returns Result with success status
   */
  deleteServerLocally(serverId: string): ServerDeletionResult;

  /**
   * Gets the local path for a server
   * @param serverId Server identifier
   * @returns Absolute path to server directory
   */
  getLocalServerPath(serverId: string): string;
}
