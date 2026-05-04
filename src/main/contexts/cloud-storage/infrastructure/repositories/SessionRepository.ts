import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import { ISessionRepository } from "@main/contexts/cloud-storage/domain/repositories";
import {
  CloudSyncState,
  S3Config,
  SessionMetadata,
  ServerStatistics,
  SessionEntry,
} from "@main/contexts/cloud-storage/domain/entities";
import { mergeSessionMetadata } from "@main/contexts/cloud-storage/domain/utils/mergeSessionMetadata";
import { RcloneRepository } from "./RcloneRepository";
import { FileSystemError, ExternalServiceError, NotFoundError } from "@shared/domain/errors";

const execAsync = promisify(exec);

@injectable()
export class SessionRepository implements ISessionRepository {
  constructor(private rcloneRepository: RcloneRepository) {}

  createSession(serverId: string, username: string): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const sessionFilePath = path.join(serverPath, "session.json");

    if (!fs.existsSync(serverPath)) {
      throw new NotFoundError("Server directory", serverId);
    }

    try {
      const now = new Date();
      const nowTimestamp = Date.now();

      let existingData: SessionMetadata | null = null;
      if (fs.existsSync(sessionFilePath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(sessionFilePath, "utf-8"));
        } catch {
          console.warn(`Could not parse existing session.json, creating new one`);
        }
      }

      const newSession: SessionEntry = {
        username: username,
        startTime: now.toISOString(),
        startTimestamp: nowTimestamp,
      };

      const sessionData: SessionMetadata = {
        lastPlayed: now.toISOString(),
        lastPlayedTimestamp: nowTimestamp,
        username: username,
        sessions: existingData?.sessions ? [...existingData.sessions, newSession] : [newSession],
      };

      fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2), "utf-8");
      this.writeCloudSyncState(serverId, {
        localChangesPendingUpload: true,
        lastLocalChangeTimestamp: nowTimestamp,
      });
      console.log(`[SESSION] Created session metadata for ${serverId} (user: ${username})`);
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to create session for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  updateSession(serverId: string, username: string): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const sessionFilePath = path.join(serverPath, "session.json");

    if (!fs.existsSync(serverPath)) {
      throw new NotFoundError("Server directory", serverId);
    }

    if (!fs.existsSync(sessionFilePath)) {
      throw new NotFoundError("Session file", sessionFilePath);
    }

    let sessionData: SessionMetadata;
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFilePath, "utf-8"));
    } catch (error) {
      throw new FileSystemError(
        `Failed to parse session.json for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const now = Date.now();
      const nowISO = new Date().toISOString();

      if (sessionData.sessions && sessionData.sessions.length > 0) {
        const lastSession = sessionData.sessions[sessionData.sessions.length - 1];

        if (!lastSession.endTime) {
          const duration = now - lastSession.startTimestamp;
          lastSession.endTime = nowISO;
          lastSession.endTimestamp = now;
          lastSession.duration = duration;

          const durationMinutes = Math.floor(duration / 60000);
          const durationSeconds = Math.floor((duration % 60000) / 1000);
          console.log(
            `[SESSION] Updated session metadata for ${serverId} (user: ${username}, duration: ${durationMinutes}m ${durationSeconds}s)`,
          );
        }
      }

      sessionData.lastPlayed = nowISO;
      sessionData.lastPlayedTimestamp = now;
      sessionData.username = username;

      fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2), "utf-8");
      this.writeCloudSyncState(serverId, {
        localChangesPendingUpload: true,
        lastLocalChangeTimestamp: now,
      });
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to update session for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadSession(config: S3Config, serverId: string): Promise<boolean> {
    await this.rcloneRepository.ensureConfigured(config);

    const rclonePath = this.rcloneRepository.getRclonePath();
    const configName = this.rcloneRepository.getRcloneConfigName();
    const serverPath = this.getLocalServerPath(serverId);
    const sessionFilePath = path.join(serverPath, "session.json");
    const r2SessionPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/session.json`;

    if (!fs.existsSync(sessionFilePath)) {
      throw new NotFoundError("Session file", sessionFilePath);
    }

    try {
      const localSession = this.readLocalSession(serverId);
      const remoteSession = await this.readRemoteSession(rclonePath, r2SessionPath);
      const mergedSession = mergeSessionMetadata(localSession, remoteSession);

      if (!mergedSession) {
        throw new NotFoundError("Merged session metadata", sessionFilePath);
      }

      fs.writeFileSync(sessionFilePath, JSON.stringify(mergedSession, null, 2), "utf-8");

      const copyCommand = `"${rclonePath}" copyto "${sessionFilePath}" ${r2SessionPath}`;
      await execAsync(copyCommand, { maxBuffer: 1024 * 1024 });
      this.clearPendingUpload(serverId);

      console.log(`[SESSION] Uploaded session metadata to R2 for ${serverId}`);
      return true;
    } catch (error) {
      this.markPendingUpload(serverId);
      throw new ExternalServiceError(
        "R2",
        `Failed to upload session for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getStatistics(serverId: string): ServerStatistics | null {
    try {
      const sessionData = this.readLocalSession(serverId);

      if (!sessionData || !sessionData.sessions) {
        return null;
      }

      const totalPlaytime = sessionData.sessions.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);

      return {
        totalPlaytime,
        sessionCount: sessionData.sessions.length,
        sessions: sessionData.sessions,
      };
    } catch (error) {
      // Unexpected error reading/parsing R2 session data
      throw new ExternalServiceError(
        "R2",
        `Failed to get statistics for server ${serverId}`,
        "EXTERNAL_SERVICE_ERROR",
        error,
      );
    }
  }

  readLocalSession(serverId: string): SessionMetadata | null {
    const serverPath = this.getLocalServerPath(serverId);
    const sessionFilePath = path.join(serverPath, "session.json");

    // Expected case: file doesn't exist
    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(sessionFilePath, "utf-8");
      return JSON.parse(content) as SessionMetadata;
    } catch (error) {
      // Unexpected error reading/parsing session file
      throw new FileSystemError(
        `Failed to read or parse session file for server ${serverId}`,
        "FILESYSTEM_ERROR",
        error,
      );
    }
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }

  private getCloudSyncStatePath(serverId: string): string {
    return path.join(this.getLocalServerPath(serverId), ".cloud-sync-state.json");
  }

  private writeCloudSyncState(serverId: string, state: CloudSyncState): void {
    const statePath = this.getCloudSyncStatePath(serverId);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  private markPendingUpload(serverId: string): void {
    const existingState = this.readCloudSyncState(serverId);
    this.writeCloudSyncState(serverId, {
      localChangesPendingUpload: true,
      lastLocalChangeTimestamp: existingState?.lastLocalChangeTimestamp || Date.now(),
    });
  }

  private clearPendingUpload(serverId: string): void {
    this.writeCloudSyncState(serverId, {
      localChangesPendingUpload: false,
      lastLocalChangeTimestamp: Date.now(),
    });
  }

  private readCloudSyncState(serverId: string): CloudSyncState | null {
    const statePath = this.getCloudSyncStatePath(serverId);

    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(statePath, "utf-8")) as CloudSyncState;
    } catch {
      return null;
    }
  }

  private async readRemoteSession(
    rclonePath: string,
    remoteSessionPath: string,
  ): Promise<SessionMetadata | null> {
    try {
      const catCommand = `"${rclonePath}" cat ${remoteSessionPath}`;
      const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });
      return JSON.parse(stdout.trim()) as SessionMetadata;
    } catch {
      return null;
    }
  }
}
