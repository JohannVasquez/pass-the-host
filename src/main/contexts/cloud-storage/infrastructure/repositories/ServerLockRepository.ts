import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import { IServerLockRepository } from "../../domain/repositories";
import { R2Config, ServerLock } from "../../domain/entities";
import { RcloneRepository } from "./RcloneRepository";

const execAsync = promisify(exec);

@injectable()
export class ServerLockRepository implements IServerLockRepository {
  constructor(private rcloneRepository: RcloneRepository) {}

  createLock(serverId: string, username: string): boolean {
    try {
      const serverPath = this.getLocalServerPath(serverId);
      const lockFilePath = path.join(serverPath, "server.lock");

      if (!fs.existsSync(serverPath)) {
        console.error(`Server directory not found: ${serverPath}`);
        return false;
      }

      const lockContent = {
        username: username,
        startedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };

      fs.writeFileSync(lockFilePath, JSON.stringify(lockContent, null, 2), "utf-8");
      return true;
    } catch (error) {
      console.error(`Error creating server lock for ${serverId}:`, error);
      return false;
    }
  }

  async readLock(config: R2Config, serverId: string): Promise<ServerLock> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

      const catCommand = `"${rclonePath}" cat ${r2LockPath}`;
      const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });

      const lockContent = JSON.parse(stdout.trim());

      return {
        exists: true,
        username: lockContent.username,
        startedAt: lockContent.startedAt,
        timestamp: lockContent.timestamp,
      };
    } catch (error: any) {
      return { exists: false };
    }
  }

  async uploadLock(config: R2Config, serverId: string): Promise<boolean> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const serverPath = this.getLocalServerPath(serverId);
      const lockFilePath = path.join(serverPath, "server.lock");
      const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

      if (!fs.existsSync(lockFilePath)) {
        console.error(`Lock file not found: ${lockFilePath}`);
        return false;
      }

      const copyCommand = `"${rclonePath}" copyto "${lockFilePath}" ${r2LockPath}`;
      await execAsync(copyCommand, { maxBuffer: 1024 * 1024 });

      return true;
    } catch (error) {
      console.error(`Error uploading server lock for ${serverId}:`, error);
      return false;
    }
  }

  async deleteLock(
    config: R2Config,
    serverId: string
  ): Promise<{ success: boolean; existed: boolean }> {
    try {
      await this.rcloneRepository.ensureConfigured(config);

      const rclonePath = this.rcloneRepository.getRclonePath();
      const configName = this.rcloneRepository.getRcloneConfigName();
      const r2LockPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

      const checkCommand = `"${rclonePath}" ls ${r2LockPath}`;
      try {
        await execAsync(checkCommand, { maxBuffer: 1024 * 1024 });
      } catch (error) {
        return { success: true, existed: false };
      }

      const deleteCommand = `"${rclonePath}" deletefile ${r2LockPath}`;
      await execAsync(deleteCommand, { maxBuffer: 1024 * 1024 });

      return { success: true, existed: true };
    } catch (error) {
      console.error(`Error deleting server lock for ${serverId}:`, error);
      return { success: false, existed: true };
    }
  }

  deleteLocalLock(serverId: string): { success: boolean; existed: boolean } {
    try {
      const serverPath = this.getLocalServerPath(serverId);
      const lockFilePath = path.join(serverPath, "server.lock");

      if (!fs.existsSync(lockFilePath)) {
        return { success: true, existed: false };
      }

      fs.unlinkSync(lockFilePath);
      return { success: true, existed: true };
    } catch (error) {
      console.error(`Error deleting local server lock for ${serverId}:`, error);
      return { success: false, existed: true };
    }
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
