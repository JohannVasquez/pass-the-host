import { injectable } from "inversify";
import type { ISessionRepository } from "@session-tracking/domain/repositories";
import type { S3Config } from "@cloud-storage/domain/entities";
import type { ServerStatistics } from "@session-tracking/domain/entities";

/**
 * Session Repository implementation using IPC
 * Communicates with the main process for session operations
 */
@injectable()
export class SessionRepository implements ISessionRepository {
  async createSession(serverId: string, username: string): Promise<boolean> {
    return await window.serverAPI.createSession(serverId, username);
  }

  async updateSession(serverId: string, username: string): Promise<boolean> {
    return await window.serverAPI.updateSession(serverId, username);
  }

  async uploadSession(s3Config: S3Config, serverId: string): Promise<boolean> {
    return await window.serverAPI.uploadSession(s3Config, serverId);
  }

  async getStatistics(serverId: string): Promise<ServerStatistics | null> {
    const stats = await window.serverAPI.getStatistics(serverId);
    if (!stats) return null;

    return {
      serverId,
      totalPlaytime: stats.totalPlaytime,
      sessionCount: stats.sessionCount,
      sessions: stats.sessions,
    };
  }
}
