/**
 * Session entity
 * Represents a server session (play time)
 */
export interface Session {
  username: string;
  startTime: string;
  startTimestamp: number;
  endTime?: string;
  endTimestamp?: number;
  duration?: number; // in milliseconds
}

/**
 * Server Statistics
 * Aggregated statistics for a server
 */
export interface ServerStatistics {
  serverId: string;
  totalPlaytime: number; // in milliseconds
  sessionCount: number;
  sessions: Session[];
}
