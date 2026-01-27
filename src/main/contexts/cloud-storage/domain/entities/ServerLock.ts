export interface ServerLock {
  exists: boolean;
  username?: string;
  startedAt?: string;
  timestamp?: number;
}
