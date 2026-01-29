import type { S3Config } from "@cloud-storage/domain/entities";
import type { ServerStatistics } from "../entities";

/**
 * Session Repository interface
 * Defines operations for managing server sessions
 */
export interface ISessionRepository {
  /**
   * Creates a new session for a server
   */
  createSession(serverId: string, username: string): Promise<boolean>;

  /**
   * Updates the current session (end time)
   */
  updateSession(serverId: string, username: string): Promise<boolean>;

  /**
   * Uploads session data to S3-compatible storage
   */
  uploadSession(s3Config: S3Config, serverId: string): Promise<boolean>;

  /**
   * Gets server statistics including all sessions
   */
  getStatistics(serverId: string): Promise<ServerStatistics | null>;
}
