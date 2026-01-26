import { injectable } from 'inversify';
import type { IServerLockRepository } from '../../domain/repositories';
import type { R2Config } from '@cloud-storage/domain/entities';
import type { ServerLock, LockCheckResult, LockOperationResult } from '../../domain/entities';

/**
 * Server Lock Repository implementation using IPC
 * Communicates with the main process for lock operations
 */
@injectable()
export class ServerLockRepository implements IServerLockRepository {
  async createLocalLock(serverId: string, username: string): Promise<boolean> {
    try {
      return await window.serverAPI.createLock(serverId, username);
    } catch (error) {
      console.error(`Error creating lock for server ${serverId}:`, error);
      return false;
    }
  }

  async readRemoteLock(r2Config: R2Config, serverId: string): Promise<LockCheckResult> {
    try {
      const result = await window.serverAPI.readLock(r2Config, serverId);

      if (!result.exists) {
        return { exists: false };
      }

      const lock: ServerLock = {
        serverId,
        username: result.username || 'Unknown',
        startedAt: result.startedAt || new Date().toISOString(),
        timestamp: result.timestamp || Date.now(),
      };

      return {
        exists: true,
        lock,
      };
    } catch (error) {
      console.error(`Error reading remote lock for server ${serverId}:`, error);
      return { exists: false };
    }
  }

  async uploadLock(r2Config: R2Config, serverId: string): Promise<boolean> {
    try {
      return await window.serverAPI.uploadLock(r2Config, serverId);
    } catch (error) {
      console.error(`Error uploading lock for server ${serverId}:`, error);
      return false;
    }
  }

  async deleteRemoteLock(r2Config: R2Config, serverId: string): Promise<LockOperationResult> {
    try {
      const result = await window.serverAPI.deleteLock(r2Config, serverId);
      return {
        success: result.success,
        existed: result.existed,
      };
    } catch (error) {
      console.error(`Error deleting remote lock for server ${serverId}:`, error);
      return { success: false, existed: false };
    }
  }

  async deleteLocalLock(serverId: string): Promise<LockOperationResult> {
    try {
      const result = await window.serverAPI.deleteLocalLock(serverId);
      return {
        success: result.success,
        existed: result.existed,
      };
    } catch (error) {
      console.error(`Error deleting local lock for server ${serverId}:`, error);
      return { success: false, existed: false };
    }
  }
}
