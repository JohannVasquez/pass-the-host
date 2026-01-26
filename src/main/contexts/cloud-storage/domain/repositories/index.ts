import { R2Config, ServerInfo, TransferProgress } from "../entities/R2Config";
import { ServerLock } from "../entities/ServerLock";
import { SessionMetadata, ServerStatistics } from "../entities/SessionMetadata";

export interface IRcloneRepository {
  /**
   * Check if rclone is installed
   */
  checkInstallation(): Promise<boolean>;

  /**
   * Install rclone
   */
  install(onProgress?: (message: string) => void): Promise<boolean>;

  /**
   * Test R2 connection
   */
  testConnection(config: R2Config): Promise<boolean>;
}

export interface IR2ServerRepository {
  /**
   * List all servers in R2
   */
  listServers(config: R2Config): Promise<ServerInfo[]>;

  /**
   * Download server from R2
   */
  downloadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean>;

  /**
   * Upload server to R2
   */
  uploadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<boolean>;

  /**
   * Delete server from R2
   */
  deleteServer(config: R2Config, serverId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Check if server should be downloaded (compares timestamps)
   */
  shouldDownloadServer(config: R2Config, serverId: string): Promise<boolean>;
}

export interface IServerLockRepository {
  /**
   * Create server lock file locally
   */
  createLock(serverId: string, username: string): boolean;

  /**
   * Read server lock from R2
   */
  readLock(config: R2Config, serverId: string): Promise<ServerLock>;

  /**
   * Upload lock file to R2
   */
  uploadLock(config: R2Config, serverId: string): Promise<boolean>;

  /**
   * Delete lock file from R2
   */
  deleteLock(config: R2Config, serverId: string): Promise<{ success: boolean; existed: boolean }>;

  /**
   * Delete local lock file
   */
  deleteLocalLock(serverId: string): { success: boolean; existed: boolean };
}

export interface ISessionRepository {
  /**
   * Create session metadata locally
   */
  createSession(serverId: string, username: string): boolean;

  /**
   * Update session metadata with end time
   */
  updateSession(serverId: string, username: string): boolean;

  /**
   * Upload session metadata to R2
   */
  uploadSession(config: R2Config, serverId: string): Promise<boolean>;

  /**
   * Get server statistics
   */
  getStatistics(serverId: string): ServerStatistics | null;

  /**
   * Read local session metadata
   */
  readLocalSession(serverId: string): SessionMetadata | null;
}

export interface IServerPropertiesRepository {
  /**
   * Read server port from server.properties
   */
  readPort(serverId: string): number;

  /**
   * Write server port to server.properties
   */
  writePort(serverId: string, port: number): boolean;
}
