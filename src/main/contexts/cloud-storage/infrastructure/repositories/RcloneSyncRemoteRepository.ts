import { injectable } from "inversify";
import { app } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec, execFile, spawn } from "child_process";
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
const execFileAsync = promisify(execFile);

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

  async uploadFiles(
    config: S3Config,
    serverId: string,
    relativePaths: string[],
    localServerPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void> {
    if (relativePaths.length === 0) return;

    await this.withFileList(relativePaths, (listPath) =>
      this.runTransfer(
        ["copy", localServerPath, this.getRemoteServerDirectory(config, serverId), ...this.batchFlags(listPath)],
        `upload ${relativePaths.length} files for ${serverId}`,
        onProgress,
      ),
    );
  }

  async downloadFiles(
    config: S3Config,
    serverId: string,
    relativePaths: string[],
    localServerPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void> {
    if (relativePaths.length === 0) return;

    fs.mkdirSync(localServerPath, { recursive: true });
    await this.withFileList(relativePaths, (listPath) =>
      this.runTransfer(
        ["copy", this.getRemoteServerDirectory(config, serverId), localServerPath, ...this.batchFlags(listPath)],
        `download ${relativePaths.length} files for ${serverId}`,
        onProgress,
      ),
    );
  }

  async deleteFiles(config: S3Config, serverId: string, relativePaths: string[]): Promise<void> {
    if (relativePaths.length === 0) return;

    await this.withFileList(relativePaths, async (listPath) => {
      try {
        await execFileAsync(
          this.rcloneRepository.getRclonePath(),
          ["delete", this.getRemoteServerDirectory(config, serverId), "--files-from-raw", listPath],
          { maxBuffer: 1024 * 1024 * 10 },
        );
      } catch (error) {
        if (this.isNotFoundError(error)) {
          return;
        }

        throw new ExternalServiceError(
          "S3",
          `Failed to delete ${relativePaths.length} remote files for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async fullDownloadServer(
    config: S3Config,
    serverId: string,
    localServerPath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    fs.mkdirSync(localServerPath, { recursive: true });
    // copy, not sync: without a manifest the remote may be a half-finished upload, and sync
    // would delete every local file it doesn't have.
    await this.runTransfer(
      ["copy", this.getRemoteServerDirectory(config, serverId), localServerPath, "--transfers", "8"],
      `perform fallback download for ${serverId}`,
      onProgress,
    );
    return true;
  }

  // The manifest already decided what changed, so copy every listed file unconditionally
  // (--ignore-times) and skip listing the whole destination (--no-traverse).
  private batchFlags(listPath: string): string[] {
    return ["--files-from-raw", listPath, "--no-traverse", "--ignore-times", "--transfers", "8"];
  }

  private async withFileList<T>(
    relativePaths: string[],
    run: (listPath: string) => Promise<T>,
  ): Promise<T> {
    const listPath = path.join(
      fs.mkdtempSync(path.join(this.getTempDirectory(), "s3-files-")),
      "files.txt",
    );

    try {
      fs.writeFileSync(listPath, relativePaths.map((p) => p.replace(/\\/g, "/")).join("\n"), "utf-8");
      return await run(listPath);
    } finally {
      this.cleanupTempPath(listPath);
    }
  }

  /** Runs one rclone transfer, forwarding its byte progress. */
  private async runTransfer(
    args: string[],
    description: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const rcloneProcess = spawn(
        this.rcloneRepository.getRclonePath(),
        [...args, "--progress", "--stats", "500ms"],
        { shell: false },
      );

      let lastProgress = "";
      let stdoutBuffer = "";
      let stderrBuffer = "";
      let stderrTail = "";

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

      const consume = (buffer: string, data: Buffer): string => {
        const lines = (buffer + data.toString()).split(/[\r\n]+/);
        const rest = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            parseProgress(line);
          }
        }
        return rest;
      };

      rcloneProcess.stdout.on("data", (data: Buffer) => {
        stdoutBuffer = consume(stdoutBuffer, data);
      });

      rcloneProcess.stderr.on("data", (data: Buffer) => {
        stderrTail = (stderrTail + data.toString()).slice(-4000);
        stderrBuffer = consume(stderrBuffer, data);
      });

      rcloneProcess.on("close", (code) => {
        if (code === 0) {
          onProgress?.({ percent: 100, transferred: "Complete", total: "Complete" });
          resolve();
          return;
        }

        reject(
          new ExternalServiceError(
            "S3",
            `Failed to ${description} (code ${code}). ${stderrTail || stdoutBuffer}`,
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
    return this.rcloneRepository.getServerRemotePath(config, serverId);
  }

  private getRemoteManifestPath(config: S3Config, serverId: string): string {
    return this.getRemoteFilePath(config, serverId, "manifest.json");
  }

  private getRemoteFilePath(config: S3Config, serverId: string, relativePath: string): string {
    return this.rcloneRepository.getServerRemoteFilePath(config, serverId, relativePath);
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
