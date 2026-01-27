/**
 * Remote Server entity
 * Represents a server stored in R2 cloud storage
 */
export interface RemoteServer {
  id: string;
  name: string;
  version: string;
  type: string;
  sizeBytes?: number;
  lastModified?: Date;
}

/**
 * Transfer progress information
 */
export interface TransferProgress {
  serverId: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
}

/**
 * Transfer result
 */
export interface TransferResult {
  success: boolean;
  serverId: string;
  error?: string;
}
