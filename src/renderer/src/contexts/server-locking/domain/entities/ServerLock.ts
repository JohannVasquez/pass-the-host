/**
 * Server Lock entity
 * Represents a lock on a server to prevent concurrent modifications
 */
export interface ServerLock {
  serverId: string;
  username: string;
  startedAt: string;
  timestamp: number;
}

/**
 * Lock check result
 */
export interface LockCheckResult {
  exists: boolean;
  lock?: ServerLock;
}

/**
 * Lock operation result
 */
export interface LockOperationResult {
  success: boolean;
  existed?: boolean;
}
