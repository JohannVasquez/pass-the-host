import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import {
  IS3ServerRepository,
  IS3SyncService,
} from "@main/contexts/cloud-storage/domain/repositories";
import {
  CloudSyncState,
  S3Config,
  ServerManifest,
  ServerInfo,
  TransferProgress,
  SessionMetadata,
} from "@main/contexts/cloud-storage/domain/entities";
import { RcloneRepository } from "./RcloneRepository";
import { ExternalServiceError } from "@shared/domain/errors";

const execAsync = promisify(exec);

@injectable()
export class S3ServerRepository implements IS3ServerRepository {
  constructor(
    private rcloneRepository: RcloneRepository,
    private readonly s3SyncService: IS3SyncService,
  ) {}

  async listServers(config: S3Config): Promise<ServerInfo[]> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const listCommand = `"${rclonePath}" lsf ${configName}:${config.bucket_name}/pass_the_host --dirs-only`;
      const { stdout } = await execAsync(listCommand);

      const serverDirs = stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.replace(/\/$/, ""));

      const servers = await Promise.all(
        serverDirs.map(async (serverName) => {
          const serverPath = `${configName}:${config.bucket_name}/pass_the_host/${serverName}`;
          const { version, type } = await this.detectServerVersionAndType(
            rclonePath,
            serverPath,
            serverName,
          );

          return {
            id: serverName,
            name: serverName,
            version: version,
            type: type,
          };
        }),
      );

      return servers;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to list servers: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);

      if (!fs.existsSync(localServersDir)) fs.mkdirSync(localServersDir, { recursive: true });

      if (!fs.existsSync(localServerPath)) {
        fs.mkdirSync(localServerPath, { recursive: true });
      }

      console.log(`[SYNC] Starting differential download for ${serverId} into ${localServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      const result = !!(await this.s3SyncService.downloadServer(config, serverId, onProgress));
      if (result) {
        this.writeCloudSyncState(serverId, {
          localChangesPendingUpload: false,
          lastLocalChangeTimestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to download server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);

      if (!fs.existsSync(localServerPath)) return false;

      console.log(`[SYNC] Starting differential upload for ${serverId} from ${localServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      const result = !!(await this.s3SyncService.uploadServer(config, serverId, onProgress));
      if (result) {
        this.writeCloudSyncState(serverId, {
          localChangesPendingUpload: false,
          lastLocalChangeTimestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to upload server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteServer(
    config: S3Config,
    serverId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const s3ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      const deleteCommand = `"${rclonePath}" purge ${s3ServerPath}`;
      await execAsync(deleteCommand, { maxBuffer: 1024 * 1024 });

      return { success: true };
    } catch (error: unknown) {
      throw new ExternalServiceError(
        "S3",
        `Failed to delete server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getServerSize(config: S3Config, serverId: string): Promise<number> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const s3ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      const sizeCommand = `"${rclonePath}" size ${s3ServerPath} --json`;
      const { stdout } = await execAsync(sizeCommand);
      const result = JSON.parse(stdout);
      // rclone size --json returns { "count": <number>, "bytes": <number> }
      return result.bytes || 0;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to get server size for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async shouldDownloadServer(config: S3Config, serverId: string): Promise<boolean> {
    try {
      const cloudSyncState = this.readCloudSyncState(serverId);
      if (cloudSyncState?.localChangesPendingUpload) {
        console.log(`[SESSION] Local changes pending upload for ${serverId}, skipping download`);
        return false;
      }

      // Read local session directly instead of using SessionRepository
      const localSession = this.readLocalSession(serverId);
      console.log(
        `[SESSION] Local session for ${serverId}:`,
        JSON.stringify(localSession, null, 2),
      );

      try {
        const hasRemoteChanges = await this.s3SyncService.hasRemoteChanges(config, serverId);
        if (hasRemoteChanges) {
          console.log(`[SYNC] Remote manifest changes detected for ${serverId}, download needed`);
          return true;
        }
      } catch (error) {
        console.warn(
          `[SYNC] Could not compare manifests for ${serverId}, falling back to session metadata: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await this.rcloneRepository.ensureConfigured(config);
      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const s3SessionPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/session.json`;
      const catCommand = `"${rclonePath}" cat ${s3SessionPath}`;

      let s3Session = null;
      try {
        const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });
        s3Session = JSON.parse(stdout.trim());
        console.log(`[SESSION] S3 session for ${serverId}:`, JSON.stringify(s3Session, null, 2));
      } catch {
        // File doesn't exist in S3
        console.log(`[SESSION] No S3 session file found for ${serverId}`);
      }

      if (!localSession) {
        console.log(`[SESSION] No local session found for ${serverId}, download needed`);
        return true;
      }

      if (!s3Session) {
        console.log(`[SESSION] No S3 session found for ${serverId}, using local files`);
        return false;
      }

      const localTimestamp = localSession.lastPlayedTimestamp;
      const s3Timestamp = s3Session.lastPlayedTimestamp;

      console.log(`[SESSION] Comparing timestamps - Local: ${localTimestamp}, S3: ${s3Timestamp}`);

      if (s3Timestamp > localTimestamp) {
        console.log(
          `[SESSION] S3 files are newer for ${serverId} (S3: ${s3Session.lastPlayed}, Local: ${localSession.lastPlayed}), download needed`,
        );
        return true;
      } else {
        console.log(
          `[SESSION] Local files are up to date for ${serverId} (S3: ${s3Session.lastPlayed}, Local: ${localSession.lastPlayed}), skipping download`,
        );
        return false;
      }
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to check if download needed for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getLocalManifest(serverId: string): Promise<ServerManifest> {
    return await this.s3SyncService.buildLocalManifest(serverId);
  }

  async hasRemoteChanges(config: S3Config, serverId: string): Promise<boolean> {
    return await this.s3SyncService.hasRemoteChanges(config, serverId);
  }

  private readLocalSession(serverId: string): SessionMetadata | null {
    try {
      const serverPath = path.join(app.getPath("userData"), "servers", serverId);
      const sessionFilePath = path.join(serverPath, "session.json");

      if (!fs.existsSync(sessionFilePath)) {
        return null;
      }

      const content = fs.readFileSync(sessionFilePath, "utf-8");
      return JSON.parse(content) as SessionMetadata;
    } catch {
      // Expected case: file doesn't exist or can't be parsed
      return null;
    }
  }

  private getCloudSyncStatePath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId, ".cloud-sync-state.json");
  }

  private readCloudSyncState(serverId: string): CloudSyncState | null {
    try {
      const statePath = this.getCloudSyncStatePath(serverId);

      if (!fs.existsSync(statePath)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(statePath, "utf-8")) as CloudSyncState;
    } catch {
      return null;
    }
  }

  private writeCloudSyncState(serverId: string, state: CloudSyncState): void {
    const statePath = this.getCloudSyncStatePath(serverId);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  private async detectServerVersionAndType(
    rclonePath: string,
    serverPath: string,
    _serverName: string,
  ): Promise<{ version: string; type: string }> {
    try {
      // First, try to read server_info.json if it exists
      try {
        const infoCommand = `"${rclonePath}" cat ${serverPath}/server_info.json`;
        const { stdout: infoStdout } = await execAsync(infoCommand);
        const serverInfo = JSON.parse(infoStdout.trim());
        if (serverInfo.version && serverInfo.type) {
          return { version: serverInfo.version, type: serverInfo.type };
        }
      } catch {
        // server_info.json doesn't exist or couldn't be parsed, continue with detection
      }

      const listCommand = `"${rclonePath}" lsf ${serverPath}`;
      const { stdout } = await execAsync(listCommand);

      const files = stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");

      const hasLibrariesFolder = files.some((file) => file.startsWith("libraries/"));

      if (hasLibrariesFolder) {
        try {
          const forgePathCommand = `"${rclonePath}" lsf ${serverPath}/libraries/net/minecraftforge/forge/ --dirs-only`;
          const { stdout: forgeStdout } = await execAsync(forgePathCommand);

          const forgeVersionDirs = forgeStdout
            .trim()
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => line.replace(/\/$/, ""));

          if (forgeVersionDirs.length > 0) {
            const versionDir = forgeVersionDirs[0];
            const versionMatch = versionDir.match(/^(\d+\.\d+(?:\.\d+)?)/);
            if (versionMatch) {
              return { version: versionMatch[1], type: "forge" };
            }
            return { version: versionDir, type: "forge" };
          }
        } catch (error) {
          console.error("Error checking forge version:", error);
        }
      }

      const forgeJar = files.find((file) => file.includes("forge") && file.endsWith(".jar"));
      if (forgeJar) {
        const versionMatch = forgeJar.match(/forge[.-](\d+\.\d+(?:\.\d+)?)/);
        if (versionMatch) {
          return { version: versionMatch[1], type: "forge" };
        }
        return { version: "Unknown", type: "forge" };
      }

      const hasVersionsFolder = files.some((file) => file.startsWith("versions/"));

      if (hasVersionsFolder) {
        try {
          const versionPathCommand = `"${rclonePath}" lsf ${serverPath}/versions/ --dirs-only`;
          const { stdout: versionStdout } = await execAsync(versionPathCommand);

          const versionDirs = versionStdout
            .trim()
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => line.replace(/\/$/, ""));

          if (versionDirs.length > 0) {
            const version = versionDirs[0];
            return { version: version, type: "vanilla" };
          }
        } catch (error) {
          console.error("Error checking vanilla version:", error);
        }
      }

      const hasServerJar = files.some((file) => file === "server.jar");
      if (hasServerJar) {
        return { version: "Unknown", type: "vanilla" };
      }

      return { version: "Unknown", type: "unknown" };
    } catch {
      // Expected case: unable to detect version, return unknown
      return { version: "Unknown", type: "unknown" };
    }
  }

}
