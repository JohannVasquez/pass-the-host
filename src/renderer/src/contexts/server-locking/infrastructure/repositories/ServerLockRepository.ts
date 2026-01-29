import { injectable } from "inversify";
import type { IServerLockRepository } from "@server-locking/domain/repositories";
import type { R2Config } from "@cloud-storage/domain/entities";
import type {
  ServerLock,
  LockCheckResult,
  LockOperationResult,
} from "@server-locking/domain/entities";

/**
 * Server Lock Repository implementation using IPC
 * Communicates with the main process for lock operations
 *
 * Note: Errors are now propagated from the main process and should be handled
 * by use cases or UI components, not silently caught and converted to false.
 */
@injectable()
export class ServerLockRepository implements IServerLockRepository {
  async createLocalLock(serverId: string, username: string): Promise<boolean> {
    return await window.serverAPI.createLock(serverId, username);
  }

  async readRemoteLock(r2Config: R2Config, serverId: string): Promise<LockCheckResult> {
    const result = await window.serverAPI.readLock(r2Config, serverId);

    if (!result.exists) {
      return { exists: false };
    }

    const lock: ServerLock = {
      serverId,
      username: result.username || "Unknown",
      startedAt: result.startedAt || new Date().toISOString(),
      timestamp: result.timestamp || Date.now(),
    };

    return {
      exists: true,
      lock,
    };
  }

  async uploadLock(r2Config: R2Config, serverId: string): Promise<boolean> {
    return await window.serverAPI.uploadLock(r2Config, serverId);
  }

  async deleteRemoteLock(r2Config: R2Config, serverId: string): Promise<LockOperationResult> {
    const result = await window.serverAPI.deleteLock(r2Config, serverId);
    return {
      success: result.success,
      existed: result.existed,
    };
  }

  async deleteLocalLock(serverId: string): Promise<LockOperationResult> {
    const result = await window.serverAPI.deleteLocalLock(serverId);
    return {
      success: result.success,
      existed: result.existed,
    };
  }
}
