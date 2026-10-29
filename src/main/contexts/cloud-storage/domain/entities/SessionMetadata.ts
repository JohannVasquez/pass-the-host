import type { S3Provider } from "./S3Config";

export interface SessionEntry {
  username: string;
  startTime: string; // ISO timestamp
  startTimestamp: number; // Unix timestamp
  endTime?: string; // ISO timestamp
  endTimestamp?: number; // Unix timestamp
  duration?: number; // Duration in milliseconds
}

export interface SessionMetadata {
  lastPlayed: string; // ISO timestamp
  lastPlayedTimestamp: number; // Unix timestamp
  username: string; // Username of the last player
  sessions: SessionEntry[]; // Array of all sessions
}

export interface CloudSyncState {
  localChangesPendingUpload: boolean;
  lastLocalChangeTimestamp: number;
}

/** Where a server was last uploaded to or downloaded from, kept in its local folder */
export interface CloudLocation {
  provider: S3Provider;
  bucket?: string;
}

export const CLOUD_LOCATION_FILE = ".cloud-location.json";

export interface ServerStatistics {
  totalPlaytime: number; // Total playtime in milliseconds
  sessionCount: number;
  sessions: SessionEntry[];
}
