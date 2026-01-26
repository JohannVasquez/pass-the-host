import type { R2Config } from '@cloud-storage/domain/entities';
import type { LockCheckResult, LockOperationResult } from '../entities';

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
   * Reads lock information from R2 storage
   */
  readRemoteLock(r2Config: R2Config, serverId: string): Promise<LockCheckResult>;

  /**
   * Uploads local lock to R2 storage
   */
  uploadLock(r2Config: R2Config, serverId: string): Promise<boolean>;

  /**
   * Deletes lock from R2 storage
   */
  deleteRemoteLock(r2Config: R2Config, serverId: string): Promise<LockOperationResult>;

  /**
   * Deletes local lock file
   */
  deleteLocalLock(serverId: string): Promise<LockOperationResult>;
}
