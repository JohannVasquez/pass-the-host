import type { S3Config } from "@cloud-storage/domain/entities";
import type { LockCheckResult, LockOperationResult } from "../entities";

/**
 * Server Lock Repository interface
 * Defines operations for managing server locks
 */
export interface IServerLockRepository {
  /**
   * Creates a lock file locally for a server
   */
  createLocalLock(serverId: string, username: string): Promise<boolean>;

  /**
   * Reads lock information from S3-compatible storage
   */
  readRemoteLock(s3Config: S3Config, serverId: string): Promise<LockCheckResult>;

  /**
   * Uploads local lock to S3-compatible storage
   */
  uploadLock(s3Config: S3Config, serverId: string): Promise<boolean>;

  /**
   * Deletes lock from S3-compatible storage
   */
  deleteRemoteLock(s3Config: S3Config, serverId: string): Promise<LockOperationResult>;

  /**
   * Deletes local lock file
   */
  deleteLocalLock(serverId: string): Promise<LockOperationResult>;
}
