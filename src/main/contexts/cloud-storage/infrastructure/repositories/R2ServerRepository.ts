import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import { IR2ServerRepository } from "../../domain/repositories";
import { R2Config, ServerInfo, TransferProgress } from "../../domain/entities";
import { RcloneRepository } from "./RcloneRepository";

const execAsync = promisify(exec);

@injectable()
export class R2ServerRepository implements IR2ServerRepository {
  constructor(private rcloneRepository: RcloneRepository) {}

  async listServers(config: R2Config): Promise<ServerInfo[]> {
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
      console.error("Error listing R2 servers:", error);
      return [];
    }
  }

  async downloadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);
      const r2ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

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
          } catch (error: any) {
            attempts++;
            if (error.code === "EBUSY" || error.code === "EPERM") {
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

      console.log(`[RCLONE] Starting download from ${r2ServerPath} to ${localServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      return await this.syncWithProgress(rclonePath, r2ServerPath, localServerPath, onProgress);
    } catch (error) {
      console.error(`Error downloading server ${serverId} from R2:`, error);
      return false;
    }
  }

  async uploadServer(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const localServersDir = path.join(app.getPath("userData"), "servers");
      const localServerPath = path.join(localServersDir, serverId);
      const r2ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      if (!fs.existsSync(localServerPath)) return false;

      console.log(`[RCLONE] Starting upload from ${localServerPath} to ${r2ServerPath}`);
      onProgress?.({ percent: 0, transferred: "0 B", total: "0 B" });

      return await this.syncWithProgress(rclonePath, localServerPath, r2ServerPath, onProgress);
    } catch (error) {
      console.error(`Error uploading server ${serverId} to R2:`, error);
      return false;
    }
  }

  async deleteServer(
    config: R2Config,
    serverId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const r2ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

      const deleteCommand = `"${rclonePath}" purge ${r2ServerPath}`;
      await execAsync(deleteCommand, { maxBuffer: 1024 * 1024 });

      return { success: true };
    } catch (error: any) {
      console.error(`Error deleting server ${serverId} from R2:`, error);
      return { success: false, error: error.message || "Unknown error" };
    }
  }

  async shouldDownloadServer(config: R2Config, serverId: string): Promise<boolean> {
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
      const r2SessionPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/session.json`;
      const catCommand = `"${rclonePath}" cat ${r2SessionPath}`;

      let r2Session = null;
      try {
        const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });
        r2Session = JSON.parse(stdout.trim());
        console.log(`[SESSION] R2 session for ${serverId}:`, JSON.stringify(r2Session, null, 2));
      } catch (e) {
        // File doesn't exist in R2
        console.log(`[SESSION] No R2 session file found for ${serverId}`);
      }

      if (!localSession) {
        console.log(`[SESSION] No local session found for ${serverId}, download needed`);
        return true;
      }

      if (!r2Session) {
        console.log(`[SESSION] No R2 session found for ${serverId}, using local files`);
        return false;
      }

      const localTimestamp = localSession.lastPlayedTimestamp;
      const r2Timestamp = r2Session.lastPlayedTimestamp;

      console.log(`[SESSION] Comparing timestamps - Local: ${localTimestamp}, R2: ${r2Timestamp}`);

      if (r2Timestamp > localTimestamp) {
        console.log(
          `[SESSION] R2 files are newer for ${serverId} (R2: ${r2Session.lastPlayed}, Local: ${localSession.lastPlayed}), download needed`,
        );
        return true;
      } else {
        console.log(
          `[SESSION] Local files are up to date for ${serverId} (R2: ${r2Session.lastPlayed}, Local: ${localSession.lastPlayed}), skipping download`,
        );
        return false;
      }
    } catch (error) {
      console.error(`Error checking if download is needed for ${serverId}:`, error);
      return true;
    }
  }

  private readLocalSession(serverId: string): any {
    try {
      const serverPath = path.join(app.getPath("userData"), "servers", serverId);
      const sessionFilePath = path.join(serverPath, "session.json");

      if (!fs.existsSync(sessionFilePath)) {
        return null;
      }

      const content = fs.readFileSync(sessionFilePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading local session for ${serverId}:`, error);
      return null;
    }
  }

  private async detectServerVersionAndType(
    rclonePath: string,
    serverPath: string,
    serverName: string,
  ): Promise<{ version: string; type: string }> {
    try {
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
    } catch (error) {
      console.error(`Error detecting version for ${serverName}:`, error);
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
