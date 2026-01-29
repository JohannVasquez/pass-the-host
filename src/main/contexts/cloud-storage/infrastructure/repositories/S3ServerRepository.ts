import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import { IS3ServerRepository } from "../../domain/repositories";
import { S3Config, ServerInfo, TransferProgress, SessionMetadata } from "../../domain/entities";
import { RcloneRepository } from "./RcloneRepository";
import { ExternalServiceError } from "@shared/domain/errors";

const execAsync = promisify(exec);

@injectable()
export class S3ServerRepository implements IS3ServerRepository {
  constructor(private rcloneRepository: RcloneRepository) {}

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

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);
      const s3ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      if (!fs.existsSync(localServersDir)) fs.mkdirSync(localServersDir, { recursive: true });

      // Try to delete existing folder with retries
      if (fs.existsSync(localServerPath)) {
        let deleted = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!deleted && attempts < maxAttempts) {
          try {
            console.log(
              `[RCLONE] Attempting to delete existing folder (attempt ${attempts + 1}/${maxAttempts})...`,
            );
            fs.rmSync(localServerPath, { recursive: true, force: true });
            deleted = true;
            console.log(`[RCLONE] Successfully deleted existing folder`);
          } catch (error: unknown) {
            attempts++;
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === "EBUSY" || nodeError.code === "EPERM") {
              if (attempts < maxAttempts) {
                console.log(`[RCLONE] Folder is locked, waiting 2 seconds before retry...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                console.log(
                  `[RCLONE] Could not delete folder after ${maxAttempts} attempts, will use rclone sync (may take longer)`,
                );
              }
            } else {
              throw error;
            }
          }
        }
      }

      if (!fs.existsSync(localServerPath)) {
        fs.mkdirSync(localServerPath, { recursive: true });
      }

      console.log(`[RCLONE] Starting download from ${s3ServerPath} to ${localServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      return await this.syncWithProgress(rclonePath, s3ServerPath, localServerPath, onProgress);
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

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);
      const s3ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      if (!fs.existsSync(localServerPath)) return false;

      console.log(`[RCLONE] Starting upload from ${localServerPath} to ${s3ServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      return await this.syncWithProgress(rclonePath, localServerPath, s3ServerPath, onProgress);
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
      // Read local session directly instead of using SessionRepository
      const localSession = this.readLocalSession(serverId);
      console.log(
        `[SESSION] Local session for ${serverId}:`,
        JSON.stringify(localSession, null, 2),
      );

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

  private async syncWithProgress(
    rclonePath: string,
    source: string,
    destination: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const rcloneProcess = spawn(
        rclonePath,
        ["sync", source, destination, "--progress", "--stats", "500ms", "--transfers", "8"],
        { shell: true },
      );

      let lastProgress = "";
      let stdoutBuffer = "";
      let stderrBuffer = "";

      const parseProgress = (line: string): void => {
        const match = line.match(
          /Transferred:\s+([0-9.]+\s*[KMGT]?i?B)\s*\/\s*([0-9.]+\s*[KMGT]?i?B),\s*(\d+)%/,
        );

        if (match) {
          const transferred = match[1].trim();
          const total = match[2].trim();
          const percent = parseInt(match[3]);

          const currentProgress = JSON.stringify({ transferred, percent });
          if (currentProgress !== lastProgress) {
            lastProgress = currentProgress;
            onProgress?.({ percent, transferred, total });
          }
        }
      };

      rcloneProcess.stdout.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split(/[\r\n]+/);
        stdoutBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            parseProgress(line);
          }
        }
      });

      rcloneProcess.stderr.on("data", (data: Buffer) => {
        stderrBuffer += data.toString();
        const lines = stderrBuffer.split(/[\r\n]+/);
        stderrBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            parseProgress(line);
          }
        }
      });

      rcloneProcess.on("close", (code) => {
        console.log(`[RCLONE] Process closed with code ${code}`);
        if (code === 0) {
          onProgress?.({ percent: 100, transferred: "Complete", total: "Complete" });
          resolve(true);
        } else {
          reject(new Error(`Sync failed with code ${code}`));
        }
      });

      rcloneProcess.on("error", (error) => {
        console.error(`[RCLONE ERROR]`, error);
        reject(error);
      });
    });
  }
}
