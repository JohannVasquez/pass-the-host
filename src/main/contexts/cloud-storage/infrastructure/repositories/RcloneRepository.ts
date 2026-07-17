import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import { IRcloneRepository } from "@main/contexts/cloud-storage/domain/repositories";
import { S3Config, S3Provider } from "@main/contexts/cloud-storage/domain/entities";
import { FileSystemError, ExternalServiceError } from "@shared/domain/errors";

const execFileAsync = promisify(execFile);

@injectable()
export class RcloneRepository implements IRcloneRepository {
  private isInstalling = false;
  private configuredRemoteSignature: string | null = null;
  private configuringRemotePromise: Promise<void> | null = null;
  private readonly RCLONE_VERSION = "v1.65.0";
  private readonly RCLONE_DIR = path.join(app.getPath("userData"), "rclone");
  private readonly RCLONE_EXECUTABLE = process.platform === "win32" ? "rclone.exe" : "rclone";
  private readonly RCLONE_PATH = path.join(this.RCLONE_DIR, this.RCLONE_EXECUTABLE);
  private readonly RCLONE_CONFIG_NAME = "pass-the-host-s3";

  // Map S3Provider to rclone provider string
  private getProviderString(provider: S3Provider): string {
    switch (provider) {
      case "AWS":
        return "AWS";
      case "Cloudflare":
        return "Cloudflare";
      case "MinIO":
        return "Minio";
      case "Backblaze":
        return "Backblaze";
      case "DigitalOcean":
        return "DigitalOcean";
      case "Other":
      default:
        return "Other";
    }
  }

  async checkInstallation(): Promise<boolean> {
    try {
      return fs.existsSync(this.RCLONE_PATH);
    } catch (error) {
      throw new FileSystemError(
        `Failed to check rclone installation at ${this.RCLONE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async install(onProgress?: (message: string) => void): Promise<boolean> {
    // Prevent concurrent installations
    if (this.isInstalling) {
      onProgress?.("Rclone installation already in progress...");
      let attempts = 0;
      while (this.isInstalling && attempts < 60) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }
      return await this.checkInstallation();
    }

    this.isInstalling = true;

    try {
      onProgress?.("Preparing to download rclone...");

      if (!fs.existsSync(this.RCLONE_DIR)) {
        fs.mkdirSync(this.RCLONE_DIR, { recursive: true });
      }

      const downloadUrl = this.getRcloneDownloadUrl();
      const zipPath = path.join(this.RCLONE_DIR, "rclone.zip");

      onProgress?.("Downloading rclone...");
      await this.downloadFile(downloadUrl, zipPath);

      onProgress?.("Extracting rclone...");
      await this.extractZip(zipPath, this.RCLONE_DIR);

      const platform = process.platform;
      const arch = process.arch;
      let osType: string;
      let archType: string;

      if (platform === "win32") {
        osType = "windows";
        archType = arch === "x64" ? "amd64" : "386";
      } else if (platform === "darwin") {
        osType = "osx";
        archType = arch === "arm64" ? "arm64" : "amd64";
      } else {
        osType = "linux";
        archType = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : "386";
      }

      const extractedDir = path.join(
        this.RCLONE_DIR,
        `rclone-${this.RCLONE_VERSION}-${osType}-${archType}`,
      );
      const extractedExecutable = path.join(extractedDir, this.RCLONE_EXECUTABLE);

      if (fs.existsSync(extractedExecutable)) {
        onProgress?.("Finalizing installation...");
        fs.copyFileSync(extractedExecutable, this.RCLONE_PATH);

        if (process.platform !== "win32") {
          fs.chmodSync(this.RCLONE_PATH, 0o755);
          this.removeQuarantineAttribute();
        }

        fs.unlinkSync(zipPath);
        fs.rmSync(extractedDir, { recursive: true, force: true });

        onProgress?.("Rclone installed successfully");
        return true;
      } else {
        throw new FileSystemError("Rclone executable not found in extracted files");
      }
    } catch (error) {
      onProgress?.("Failed to install rclone");
      throw new ExternalServiceError(
        "Rclone",
        `Failed to install: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isInstalling = false;
    }
  }

  async testConnection(config: S3Config): Promise<boolean> {
    try {
      await this.ensureConfigured(config);
      await this.runRclone(["lsd", `${this.RCLONE_CONFIG_NAME}:${config.bucket_name}`]);
      return true;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getBucketSize(config: S3Config): Promise<number> {
    try {
      await this.ensureConfigured(config);
      const { stdout } = await this.runRclone([
        "size",
        `${this.RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host`,
        "--json",
      ]);
      const result = JSON.parse(stdout);
      // rclone size --json returns { "count": <number>, "bytes": <number> }
      return result.bytes || 0;
    } catch (error) {
      throw new ExternalServiceError(
        "S3",
        `Failed to get bucket size: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async ensureConfigured(config: S3Config): Promise<void> {
    const signature = this.buildRemoteSignature(config);

    if (this.configuredRemoteSignature === signature) {
      return;
    }

    if (this.configuringRemotePromise) {
      await this.configuringRemotePromise;

      if (this.configuredRemoteSignature === signature) {
        return;
      }
    }

    this.configuringRemotePromise = this.configureRemote(config, signature);

    try {
      await this.configuringRemotePromise;
    } finally {
      this.configuringRemotePromise = null;
    }
  }

  private async configureRemote(config: S3Config, signature: string): Promise<void> {
    const providerStr = this.getProviderString(config.provider);
    const configArgs = [
      "config",
      "create",
      this.RCLONE_CONFIG_NAME,
      "s3",
      `provider=${providerStr}`,
      `access_key_id=${config.access_key}`,
      `secret_access_key=${config.secret_key}`,
    ];

    if (config.provider === "AWS") {
      configArgs.push(`region=${config.region || "us-east-1"}`);
    } else if (config.provider === "MinIO") {
      configArgs.push(`endpoint=${config.endpoint}`);
      configArgs.push(`region=${config.region && config.region !== "auto" ? config.region : "us-east-1"}`);
    } else {
      configArgs.push(`endpoint=${config.endpoint}`);
      configArgs.push(`region=${config.region || "auto"}`);
    }

    // Cloudflare R2 doesn't support S3 object ACLs — sending acl=private causes
    // "AccessDenied: failed to prepare upload" on every PutObject.
    if (config.provider !== "MinIO" && config.provider !== "Cloudflare") {
      configArgs.push("acl=private");
    }

    configArgs.push("--non-interactive");

    try {
      await this.deleteExistingRemote();
      await this.runRclone(configArgs);
      this.configuredRemoteSignature = signature;
    } catch (error) {
      this.configuredRemoteSignature = null;
      throw new ExternalServiceError(
        "Rclone",
        `Failed to configure S3 remote: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getRclonePath(): string {
    return this.RCLONE_PATH;
  }

  getRcloneConfigName(): string {
    return this.RCLONE_CONFIG_NAME;
  }

  private getRcloneDownloadUrl(): string {
    const platform = process.platform;
    const arch = process.arch;

    let osType: string;
    let archType: string;

    if (platform === "win32") {
      osType = "windows";
      archType = arch === "x64" ? "amd64" : "386";
    } else if (platform === "darwin") {
      osType = "osx";
      archType = arch === "arm64" ? "arm64" : "amd64";
    } else {
      osType = "linux";
      archType = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : "386";
    }

    const fileName = `rclone-${this.RCLONE_VERSION}-${osType}-${archType}.zip`;
    return `https://downloads.rclone.org/${this.RCLONE_VERSION}/${fileName}`;
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            file.close();
            if (response.headers.location) {
              this.downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
            } else {
              reject(new Error("Redirect without location header"));
            }
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close((err) => {
              if (err) {
                reject(err);
              } else {
                setTimeout(() => resolve(), 500);
              }
            });
          });
        })
        .on("error", (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
    });
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (process.platform === "win32") {
      const command = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
      execSync(command);
    } else {
      execSync(`unzip -o "${zipPath}" -d "${destDir}"`);
    }
  }

  private async runRclone(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync(this.RCLONE_PATH, args, { maxBuffer: 1024 * 1024 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stderr = this.extractExecErrorOutput(error, "stderr");
      const stdout = this.extractExecErrorOutput(error, "stdout");
      const output = [stderr, stdout].filter(Boolean).join(" | ");
      const command = `${this.RCLONE_PATH} ${args.join(" ")}`;

      throw new Error(
        output
          ? `${errorMessage}. Command: ${command}. Output: ${output}`
          : `${errorMessage}. Command: ${command}`,
      );
    }
  }

  private async deleteExistingRemote(): Promise<void> {
    try {
      await this.runRclone(["config", "delete", this.RCLONE_CONFIG_NAME]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes("didn't find section") ||
        message.includes("not found") ||
        message.includes("can't find")
      ) {
        return;
      }

      throw error;
    }
  }

  private buildRemoteSignature(config: S3Config): string {
    return JSON.stringify({
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      access_key: config.access_key,
      secret_key: config.secret_key,
      bucket_name: config.bucket_name,
    });
  }

  private extractExecErrorOutput(error: unknown, key: "stdout" | "stderr"): string {
    if (!error || typeof error !== "object" || !(key in error)) {
      return "";
    }

    const value = (error as Record<string, unknown>)[key];
    return typeof value === "string" ? value.trim() : "";
  }

  private removeQuarantineAttribute(): void {
    try {
      execSync(`xattr -d com.apple.quarantine "${this.RCLONE_PATH}"`, { stdio: "ignore" });
    } catch {
      // Best effort only: the downloaded binary may not carry quarantine metadata.
    }
  }
}
