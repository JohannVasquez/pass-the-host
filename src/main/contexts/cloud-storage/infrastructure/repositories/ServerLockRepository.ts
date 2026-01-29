import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import type { IServerLockRepository } from "../../domain/repositories";
import type { R2Config, ServerLock } from "../../domain/entities";
import { RcloneRepository } from "./RcloneRepository";
import { NotFoundError, FileSystemError, ExternalServiceError } from "@shared/domain/errors";

const execAsync = promisify(exec);

@injectable()
export class ServerLockRepository implements IServerLockRepository {
  constructor(private rcloneRepository: RcloneRepository) {}

  createLock(serverId: string, username: string): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");

    if (!fs.existsSync(serverPath)) {
      throw new NotFoundError("Server directory", serverId);
    }

    try {
      const lockContent = {
        username: username,
        startedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };

      fs.writeFileSync(lockFilePath, JSON.stringify(lockContent, null, 2), "utf-8");
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to create lock file for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async readLock(config: R2Config, serverId: string): Promise<ServerLock> {
    await this.rcloneRepository.ensureConfigured(config);

    const rclonePath = this.rcloneRepository.getRclonePath();
    const configName = this.rcloneRepository.getRcloneConfigName();
    const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    try {
      const catCommand = `"${rclonePath}" cat ${r2LockPath}`;
      const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });

      const content = stdout.trim();

      // Handle empty or invalid content - treat as no lock exists
      if (!content) {
        return { exists: false };
      }

      try {
        const lockContent = JSON.parse(content);

        // Validate lock content has required fields
        if (!lockContent.username || !lockContent.startedAt) {
          return { exists: false };
        }

        return {
          exists: true,
          username: lockContent.username,
          startedAt: lockContent.startedAt,
          timestamp: lockContent.timestamp,
        };
      } catch {
        // Invalid JSON - treat as corrupted/no lock
        return { exists: false };
      }
    } catch (error) {
      // If lock doesn't exist in R2, return non-existent lock (this is expected)
      if (error instanceof Error && error.message.includes("not found")) {
        return { exists: false };
      }
      // Other errors are unexpected
      throw new ExternalServiceError(
        "R2/Rclone",
        `Failed to read lock for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadLock(config: R2Config, serverId: string): Promise<boolean> {
    await this.rcloneRepository.ensureConfigured(config);

    const rclonePath = this.rcloneRepository.getRclonePath();
    const configName = this.rcloneRepository.getRcloneConfigName();
    const serverPath = this.getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");
    const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    if (!fs.existsSync(lockFilePath)) {
      throw new NotFoundError("Lock file", lockFilePath);
    }

    try {
      const copyCommand = `"${rclonePath}" copyto "${lockFilePath}" ${r2LockPath}`;
      await execAsync(copyCommand, { maxBuffer: 1024 * 1024 });
      return true;
    } catch (error) {
      throw new ExternalServiceError(
        "R2/Rclone",
        `Failed to upload lock for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteLock(
    config: R2Config,
    serverId: string,
  ): Promise<{ success: boolean; existed: boolean }> {
    await this.rcloneRepository.ensureConfigured(config);

    const rclonePath = this.rcloneRepository.getRclonePath();
    const configName = this.rcloneRepository.getRcloneConfigName();
    const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    // Check if lock exists
    const checkCommand = `"${rclonePath}" ls ${r2LockPath}`;
    try {
      await execAsync(checkCommand, { maxBuffer: 1024 * 1024 });
    } catch {
      // Lock doesn't exist - this is not an error
      return { success: true, existed: false };
    }

    try {
      const deleteCommand = `"${rclonePath}" deletefile ${r2LockPath}`;
      await execAsync(deleteCommand, { maxBuffer: 1024 * 1024 });
      return { success: true, existed: true };
    } catch (error) {
      throw new ExternalServiceError(
        "R2/Rclone",
        `Failed to delete lock for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  deleteLocalLock(serverId: string): { success: boolean; existed: boolean } {
    const serverPath = this.getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");

    if (!fs.existsSync(lockFilePath)) {
      // Lock doesn't exist - this is not an error
      return { success: true, existed: false };
    }

    try {
      fs.unlinkSync(lockFilePath);
      return { success: true, existed: true };
    } catch (error) {
      throw new FileSystemError(
        `Failed to delete local lock for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
