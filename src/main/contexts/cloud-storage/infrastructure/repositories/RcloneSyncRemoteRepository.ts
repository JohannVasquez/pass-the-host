import { injectable } from "inversify";
import { app } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import type { IS3SyncRemoteRepository } from "@main/contexts/cloud-storage/domain/repositories";
import type {
  S3Config,
  ServerManifest,
  TransferProgress,
} from "@main/contexts/cloud-storage/domain/entities";
import { ExternalServiceError } from "@shared/domain/errors";
import { RcloneRepository } from "./RcloneRepository";

const execAsync = promisify(exec);

@injectable()
export class RcloneSyncRemoteRepository implements IS3SyncRemoteRepository {
  constructor(private readonly rcloneRepository: RcloneRepository) {}

  async readManifest(config: S3Config, serverId: string): Promise<ServerManifest | null> {
    try {
      const { stdout } = await execAsync(
        `"${this.rcloneRepository.getRclonePath()}" cat "${this.getRemoteManifestPath(config, serverId)}"`,
        { maxBuffer: 1024 * 1024 * 10 },
      );

      const manifestContent = stdout.trim();

      if (!manifestContent) {
        console.warn(`[SYNC] Remote manifest for ${serverId} is empty, treating it as missing`);
        return null;
      }

      try {
        return JSON.parse(manifestContent) as ServerManifest;
      } catch (error) {
        console.warn(
          `[SYNC] Remote manifest for ${serverId} is invalid, treating it as missing: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw new ExternalServiceError(
        "S3",
        `Failed to read manifest for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadManifest(config: S3Config, serverId: string, manifest: ServerManifest): Promise<void> {
    const tempFilePath = path.join(
      fs.mkdtempSync(path.join(this.getTempDirectory(), "s3-manifest-")),
      "manifest.json",
    );

    try {
      fs.writeFileSync(tempFilePath, JSON.stringify(manifest, null, 2), "utf-8");
      await this.copyLocalFileToRemote(config, tempFilePath, this.getRemoteManifestPath(config, serverId));
    } finally {
      this.cleanupTempPath(tempFilePath);
    }
  }

  async uploadFile(
    config: S3Config,
    serverId: string,
    relativePath: string,
    localFilePath: string,
  ): Promise<void> {
    await this.copyLocalFileToRemote(
      config,
      localFilePath,
      this.getRemoteFilePath(config, serverId, relativePath),
    );
  }

  async downloadFile(
    config: S3Config,
    serverId: string,
    relativePath: string,
    localFilePath: string,
  ): Promise<void> {
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

    try {
      await execAsync(
        `"${this.rcloneRepository.getRclonePath()}" copyto "${this.getRemoteFilePath(config, serverId, relativePath)}" "${localFilePath}"`,
        { maxBuffer: 1024 * 1024 * 10 },
      );
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to download ${relativePath} for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteFile(config: S3Config, serverId: string, relativePath: string): Promise<void> {
    try {
      await execAsync(
        `"${this.rcloneRepository.getRclonePath()}" deletefile "${this.getRemoteFilePath(config, serverId, relativePath)}"`,
        { maxBuffer: 1024 * 1024 * 10 },
      );
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return;
      }

      throw new ExternalServiceError(
        "S3",
        `Failed to delete remote file ${relativePath} for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async fullDownloadServer(
    config: S3Config,
    serverId: string,
    localServerPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    const remoteServerPath = this.getRemoteServerDirectory(config, serverId);
    fs.mkdirSync(localServerPath, { recursive: true });

    return await new Promise<boolean>((resolve, reject) => {
      const rcloneProcess = spawn(
        this.rcloneRepository.getRclonePath(),
        [
          "sync",
          remoteServerPath,
          localServerPath,
          "--progress",
          "--stats",
          "500ms",
          "--transfers",
          "8",
        ],
        { shell: false },
      );

      let lastProgress = "";
      let stdoutBuffer = "";
      let stderrBuffer = "";

      const parseProgress = (line: string): void => {
        const match = line.match(
          /Transferred:\s+([0-9.]+\s*[KMGT]?i?B)\s*\/\s*([0-9.]+\s*[KMGT]?i?B),\s*(\d+)%/,
        );

        if (!match) {
          return;
        }

        const transferred = match[1].trim();
        const total = match[2].trim();
        const percent = parseInt(match[3]);
        const currentProgress = JSON.stringify({ transferred, total, percent });

        if (currentProgress !== lastProgress) {
          lastProgress = currentProgress;
          onProgress?.({ percent, transferred, total });
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
        if (code === 0) {
          onProgress?.({ percent: 100, transferred: "Complete", total: "Complete" });
          resolve(true);
          return;
        }

        reject(
          new ExternalServiceError(
            "S3",
            `Failed to perform fallback download for ${serverId} (code ${code}). ${stderrBuffer || stdoutBuffer}`,
          ),
        );
      });

      rcloneProcess.on("error", (error) => {
        reject(error);
      });
    });
  }

  private async copyLocalFileToRemote(
    _config: S3Config,
    localFilePath: string,
    remoteFilePath: string,
  ): Promise<void> {
    try {
      await execAsync(
        `"${this.rcloneRepository.getRclonePath()}" copyto "${localFilePath}" "${remoteFilePath}"`,
        { maxBuffer: 1024 * 1024 * 10 },
      );
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to upload file to ${remoteFilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getRemoteServerDirectory(config: S3Config, serverId: string): string {
    return `${this.rcloneRepository.getRcloneConfigName()}:${config.bucket_name}/pass_the_host/${serverId}`;
  }

  private getRemoteManifestPath(config: S3Config, serverId: string): string {
    return `${this.getRemoteServerDirectory(config, serverId)}/manifest.json`;
  }

  private getRemoteFilePath(config: S3Config, serverId: string, relativePath: string): string {
    return `${this.getRemoteServerDirectory(config, serverId)}/${relativePath.replace(/\\/g, "/")}`;
  }

  private isNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes("not found") || message.includes("didn't find") || message.includes("directory not found");
  }

  private getTempDirectory(): string {
    return app.getPath("temp") || os.tmpdir();
  }

  private cleanupTempPath(filePath: string): void {
    const tempDirectory = path.dirname(filePath);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Best effort cleanup only.
    }

    try {
      if (fs.existsSync(tempDirectory)) {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
      }
    } catch {
      // Best effort cleanup only.
    }
  }
}
