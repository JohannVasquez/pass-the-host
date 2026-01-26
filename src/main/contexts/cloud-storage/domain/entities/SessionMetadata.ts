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

export interface ServerStatistics {
  totalPlaytime: number; // Total playtime in milliseconds
  sessionCount: number;
  sessions: SessionEntry[];
}
