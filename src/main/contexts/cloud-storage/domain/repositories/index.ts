import {
  S3Config,
  ServerInfo,
  TransferProgress,
} from "@main/contexts/cloud-storage/domain/entities/S3Config";
import { ServerLock } from "@main/contexts/cloud-storage/domain/entities/ServerLock";
import {
  SessionMetadata,
  ServerStatistics,
} from "@main/contexts/cloud-storage/domain/entities/SessionMetadata";
import {
  DifferentialSyncResult,
  ServerManifest,
  ServerManifestFileEntry,
} from "@main/contexts/cloud-storage/domain/entities/ServerManifest";

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
   * Test S3-compatible storage connection
   */
  testConnection(config: S3Config): Promise<boolean>;

  /**
   * Get the size of the entire bucket in bytes
   */
  getBucketSize(config: S3Config): Promise<number>;
}

export interface IS3ServerRepository {
  /**
   * List all servers in S3-compatible storage
   */
  listServers(config: S3Config): Promise<ServerInfo[]>;

  /**
   * Download server from S3-compatible storage
   */
  downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean>;

  /**
   * Upload server to S3-compatible storage
   */
  uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean>;

  /**
   * Delete server from S3-compatible storage
   */
  deleteServer(config: S3Config, serverId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Check if server should be downloaded (compares timestamps)
   */
  shouldDownloadServer(config: S3Config, serverId: string): Promise<boolean>;

  /**
   * Get the size of a specific server in bytes
   */
  getServerSize(config: S3Config, serverId: string): Promise<number>;

  /**
   * Build a local manifest for a server directory
   */
  getLocalManifest(serverId: string): Promise<ServerManifest>;

  /**
   * Compare local and remote manifests to see if download is needed
   */
  hasRemoteChanges(config: S3Config, serverId: string): Promise<boolean>;
}

export interface IS3SyncRemoteRepository {
  readManifest(config: S3Config, serverId: string): Promise<ServerManifest | null>;

  uploadManifest(config: S3Config, serverId: string, manifest: ServerManifest): Promise<void>;

  uploadFile(
    config: S3Config,
    serverId: string,
    relativePath: string,
    localFilePath: string,
  ): Promise<void>;

  downloadFile(
    config: S3Config,
    serverId: string,
    relativePath: string,
    localFilePath: string,
  ): Promise<void>;

  deleteFile(config: S3Config, serverId: string, relativePath: string): Promise<void>;

  fullDownloadServer(
    config: S3Config,
    serverId: string,
    localServerPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean>;
}

export interface IS3SyncService {
  buildLocalManifest(serverId: string): Promise<ServerManifest>;

  uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<DifferentialSyncResult>;

  downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<DifferentialSyncResult>;

  hasRemoteChanges(config: S3Config, serverId: string): Promise<boolean>;

  diffManifests(local: ServerManifest, remote: ServerManifest): {
    newFiles: ServerManifestFileEntry[];
    modifiedFiles: ServerManifestFileEntry[];
    deletedFiles: ServerManifestFileEntry[];
    unchangedFiles: ServerManifestFileEntry[];
  };
}

export interface IServerLockRepository {
  /**
   * Create server lock file locally
   */
  createLock(serverId: string, username: string): boolean;

  /**
   * Read server lock from S3-compatible storage
   */
  readLock(config: S3Config, serverId: string): Promise<ServerLock>;

  /**
   * Upload lock file to S3-compatible storage
   */
  uploadLock(config: S3Config, serverId: string): Promise<boolean>;

  /**
   * Delete lock file from S3-compatible storage
   */
  deleteLock(config: S3Config, serverId: string): Promise<{ success: boolean; existed: boolean }>;

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
   * Upload session metadata to S3-compatible storage
   */
  uploadSession(config: S3Config, serverId: string): Promise<boolean>;

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
