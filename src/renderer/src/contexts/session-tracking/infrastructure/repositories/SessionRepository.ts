import { injectable } from "inversify";
import type { ISessionRepository } from "../../domain/repositories";
import type { R2Config } from "@cloud-storage/domain/entities";
import type { ServerStatistics } from "../../domain/entities";

/**
 * Session Repository implementation using IPC
 * Communicates with the main process for session operations
 */
@injectable()
export class SessionRepository implements ISessionRepository {
  async createSession(serverId: string, username: string): Promise<boolean> {
    try {
      return await window.serverAPI.createSession(serverId, username);
    } catch (error) {
      console.error(`Error creating session for server ${serverId}:`, error);
      return false;
    }
  }

  async updateSession(serverId: string, username: string): Promise<boolean> {
    try {
      return await window.serverAPI.updateSession(serverId, username);
    } catch (error) {
      console.error(`Error updating session for server ${serverId}:`, error);
      return false;
    }
  }

  async uploadSession(r2Config: R2Config, serverId: string): Promise<boolean> {
    try {
      return await window.serverAPI.uploadSession(r2Config, serverId);
    } catch (error) {
      console.error(`Error uploading session for server ${serverId}:`, error);
      return false;
    }
  }

  async getStatistics(serverId: string): Promise<ServerStatistics | null> {
    try {
      const stats = await window.serverAPI.getStatistics(serverId);
      if (!stats) return null;

      return {
        serverId,
        totalPlaytime: stats.totalPlaytime,
        sessionCount: stats.sessionCount,
        sessions: stats.sessions,
      };
    } catch (error) {
      console.error(`Error getting statistics for server ${serverId}:`, error);
      return null;
    }
  }
}
