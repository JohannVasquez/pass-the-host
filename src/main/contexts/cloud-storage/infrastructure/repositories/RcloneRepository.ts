import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { createHash } from "crypto";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import { IRcloneRepository } from "@main/contexts/cloud-storage/domain/repositories";
import { S3Config, S3Provider } from "@main/contexts/cloud-storage/domain/entities";
import {
  FileSystemError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "@shared/domain/errors";

const execFileAsync = promisify(execFile);

@injectable()
export class RcloneRepository implements IRcloneRepository {
  private isInstalling = false;
  private readonly configuredRemotes = new Set<string>();
  private readonly configuringRemotes = new Map<string, Promise<void>>();
  private staleRemotesPruned: Promise<void> | null = null;
  private readonly RCLONE_VERSION = "v1.65.0";
  private readonly RCLONE_DIR = path.join(app.getPath("userData"), "rclone");
  private readonly RCLONE_EXECUTABLE = process.platform === "win32" ? "rclone.exe" : "rclone";
  private readonly RCLONE_PATH = path.join(this.RCLONE_DIR, this.RCLONE_EXECUTABLE);
  // Every remote this app creates starts with this; see getRemoteName.
  private readonly REMOTE_PREFIX = "pass-the-host-";
  private readonly DRIVE_AUTHORIZE_TIMEOUT_MS = 5 * 60 * 1000;
  // serverId -> Drive folder ID of servers shared with this account. Filled by listSharedDriveServers.
  // ponytail: in-memory only, so the server list must load before syncing a shared server.
  private readonly sharedDriveFolders = new Map<string, string>();
  private driveAuthorization: AbortController | null = null;

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
      const remoteName = this.getRemoteName(config);
      const target = this.isDrive(config)
        ? `${remoteName}:`
        : `${remoteName}:${config.bucket_name}`;
      await this.runRclone(["lsd", target]);
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
      const { stdout } = await this.runRclone(["size", this.getRemoteRoot(config), "--json"]);
      const result = JSON.parse(stdout);
      // rclone size --json returns { "count": <number>, "bytes": <number> }
      return result.bytes || 0;
    } catch (error) {
      // Drive has real folders: pass_the_host doesn't exist until the first upload.
      if (this.isNotFoundError(error)) {
        return 0;
      }

      throw new ExternalServiceError(
        "S3",
        `Failed to get bucket size: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async ensureConfigured(config: S3Config): Promise<void> {
    await (this.staleRemotesPruned ??= this.pruneStaleRemotes());

    const remoteName = this.getRemoteName(config);
    if (this.configuredRemotes.has(remoteName)) {
      return;
    }

    // Same name means same config, so a configure already running is all we need.
    const inFlight = this.configuringRemotes.get(remoteName);
    if (inFlight) {
      return await inFlight;
    }

    const configuring = this.configureRemote(config, remoteName);
    this.configuringRemotes.set(remoteName, configuring);

    try {
      await configuring;
    } finally {
      this.configuringRemotes.delete(remoteName);
    }
  }

  /**
   * Drops the remotes earlier runs left in rclone.conf (old keys and tokens). Runs once, and
   * every ensureConfigured waits for it, so no request of this process can be using them.
   */
  private async pruneStaleRemotes(): Promise<void> {
    try {
      const { stdout } = await this.runRclone(["listremotes"]);
      const staleRemotes = stdout
        .split("\n")
        .map((line) => line.trim().replace(/:$/, ""))
        .filter((name) => name.startsWith(this.REMOTE_PREFIX));

      for (const remoteName of staleRemotes) {
        await this.deleteExistingRemote(remoteName);
      }
    } catch (error) {
      // Best effort: a stale entry only wastes a line in rclone.conf.
      console.warn(
        `[RCLONE] Could not prune stale remotes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async configureRemote(config: S3Config, remoteName: string): Promise<void> {
    try {
      const configArgs = this.isDrive(config)
        ? this.buildDriveConfigArgs(config, remoteName)
        : this.buildS3ConfigArgs(config, remoteName);

      await this.deleteExistingRemote(remoteName);
      await this.runRclone(configArgs);
      this.configuredRemotes.add(remoteName);
    } catch (error) {
      throw new ExternalServiceError(
        "Rclone",
        `Failed to configure ${config.provider} remote: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildDriveConfigArgs(config: S3Config, remoteName: string): string[] {
    if (!config.drive_token) {
      throw new ExternalServiceError("Google Drive", "Not connected: sign in with Google first");
    }

    const { clientId, clientSecret } = this.getDriveCredentials();
    return [
      "config",
      "create",
      remoteName,
      "drive",
      `client_id=${clientId}`,
      `client_secret=${clientSecret}`,
      "scope=drive",
      `token=${config.drive_token}`,
      "--non-interactive",
    ];
  }

  private buildS3ConfigArgs(config: S3Config, remoteName: string): string[] {
    const providerStr = this.getProviderString(config.provider);
    const configArgs = [
      "config",
      "create",
      remoteName,
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
    return configArgs;
  }

  /**
   * Opens the browser for Google sign-in and returns the OAuth token JSON to store in config.
   */
  async authorizeDrive(): Promise<string> {
    const { clientId, clientSecret } = this.getDriveCredentials();

    // One sign-in at a time: rclone's callback server listens on a fixed local port.
    this.cancelDriveAuthorization();
    const authorization = new AbortController();
    this.driveAuthorization = authorization;

    try {
      const { stdout } = await execFileAsync(
        this.RCLONE_PATH,
        ["authorize", "drive", clientId, clientSecret],
        {
          maxBuffer: 1024 * 1024,
          timeout: this.DRIVE_AUTHORIZE_TIMEOUT_MS,
          signal: authorization.signal,
        },
      );
      // rclone prints the token as one JSON line between "--->" and "<---End paste".
      const token = stdout.match(/^\{.*\}$/m)?.[0];
      if (!token || !JSON.parse(token).refresh_token) {
        throw new Error(`Unexpected rclone authorize output: ${stdout}`);
      }
      return token;
    } catch (error) {
      if (authorization.signal.aborted) {
        throw new ExternalServiceError("Google Drive", "Sign-in cancelled");
      }

      // error.message embeds the full command line; log rclone's own output, minus the secret.
      const output =
        this.extractExecErrorOutput(error, "stderr") ||
        (error instanceof Error ? error.message : String(error));
      throw new ExternalServiceError(
        "Google Drive",
        `Sign-in failed: ${output.split(clientSecret).join("***")}`,
      );
    } finally {
      if (this.driveAuthorization === authorization) {
        this.driveAuthorization = null;
      }
    }
  }

  /**
   * Stops a pending sign-in. The browser never tells rclone when the user closes the tab,
   * so without this it would wait until the timeout.
   */
  cancelDriveAuthorization(): void {
    this.driveAuthorization?.abort();
    this.driveAuthorization = null;
  }

  /** Remote directory that holds this account's own servers. */
  getRemoteRoot(config: S3Config): string {
    return this.isDrive(config)
      ? `${this.getRemoteName(config)}:pass_the_host`
      : `${this.getRemoteName(config)}:${config.bucket_name}/pass_the_host`;
  }

  /** Remote directory of one server. Shared Drive servers are addressed by folder ID. */
  getServerRemotePath(config: S3Config, serverId: string): string {
    const sharedFolderId = this.isDrive(config) ? this.sharedDriveFolders.get(serverId) : undefined;
    return sharedFolderId
      ? this.driveFolderRemote(config, sharedFolderId)
      : `${this.getRemoteRoot(config)}/${serverId}`;
  }

  getServerRemoteFilePath(config: S3Config, serverId: string, relativePath: string): string {
    const serverPath = this.getServerRemotePath(config, serverId);
    const separator = serverPath.endsWith(":") ? "" : "/";
    return `${serverPath}${separator}${relativePath.replace(/\\/g, "/")}`;
  }

  /**
   * Finds servers other accounts shared with this one: a whole shared `pass_the_host`
   * folder contributes all its subfolders, any other shared folder counts if it holds
   * server files. Names already in `ownServerIds` (or seen earlier) are skipped, because
   * two servers with the same id would share one local folder and overwrite each other.
   */
  async listSharedDriveServers(
    config: S3Config,
    ownServerIds: Set<string>,
  ): Promise<string[]> {
    await this.ensureConfigured(config);
    this.sharedDriveFolders.clear();

    let sharedFolders: Array<{ Name: string; ID: string }>;
    try {
      sharedFolders = await this.listDriveFolders(`${this.getRemoteName(config)},shared_with_me:`);
    } catch (error) {
      // Own servers must still load if "Shared with me" can't be read.
      console.warn(`[DRIVE] Could not list shared folders: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }

    const candidates = (
      await Promise.all(
        sharedFolders.map(async (folder) => {
          if (folder.Name === "pass_the_host") {
            return await this.listDriveFolders(this.driveFolderRemote(config, folder.ID));
          }
          return (await this.isDriveServerFolder(config, folder.ID)) ? [folder] : [];
        }),
      )
    ).flat();

    const serverIds: string[] = [];
    for (const folder of candidates) {
      if (ownServerIds.has(folder.Name) || this.sharedDriveFolders.has(folder.Name)) {
        console.warn(`[DRIVE] Skipping shared server "${folder.Name}": a server with that name already exists`);
        continue;
      }
      this.sharedDriveFolders.set(folder.Name, folder.ID);
      serverIds.push(folder.Name);
    }

    return serverIds;
  }

  /**
   * Gives `email` editor access to a server's Drive folder. Google emails them the invite,
   * and the server then shows up in their app under "Shared with me".
   */
  async shareDriveServer(config: S3Config, serverId: string, email: string): Promise<void> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError(`Invalid email address: ${email}`);
    }

    await this.ensureConfigured(config);
    const folderId = await this.getDriveFolderId(config, serverId);
    const accessToken = await this.getDriveAccessToken(config);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new ExternalServiceError(
        "Google Drive",
        `Could not share ${serverId} with ${email}: ${body?.error?.message ?? response.statusText}`,
      );
    }
  }

  private async getDriveFolderId(config: S3Config, serverId: string): Promise<string> {
    const sharedFolderId = this.sharedDriveFolders.get(serverId);
    if (sharedFolderId) {
      return sharedFolderId;
    }

    try {
      const folder = (await this.listDriveFolders(this.getRemoteRoot(config))).find(
        (entry) => entry.Name === serverId,
      );
      if (folder) {
        return folder.ID;
      }
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }

    // Only exists in Drive after its first upload.
    throw new NotFoundError("Drive folder for server", serverId);
  }

  // The stored access token expires after an hour; trade the refresh token for a fresh one.
  private async getDriveAccessToken(config: S3Config): Promise<string> {
    const { clientId, clientSecret } = this.getDriveCredentials();
    const refreshToken = config.drive_token ? JSON.parse(config.drive_token).refresh_token : null;

    if (!refreshToken) {
      throw new ExternalServiceError("Google Drive", "Not connected: sign in with Google first");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        "Google Drive",
        `Could not refresh the Google session (${response.status}): sign in with Google again`,
      );
    }

    return ((await response.json()) as { access_token: string }).access_token;
  }

  isNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes("not found") || message.includes("didn't find");
  }

  private async listDriveFolders(remote: string): Promise<Array<{ Name: string; ID: string }>> {
    const { stdout } = await this.runRclone(["lsjson", remote, "--dirs-only", "--no-modtime", "--no-mimetype"]);
    return (JSON.parse(stdout) as Array<{ Name: string; ID?: string }>).filter(
      (entry): entry is { Name: string; ID: string } => !!entry.ID,
    );
  }

  private async isDriveServerFolder(config: S3Config, folderId: string): Promise<boolean> {
    try {
      const { stdout } = await this.runRclone([
        "lsf",
        this.driveFolderRemote(config, folderId),
        "--files-only",
      ]);
      const files = stdout.split("\n");
      return files.includes("manifest.json") || files.includes("server.properties");
    } catch {
      return false;
    }
  }

  private driveFolderRemote(config: S3Config, folderId: string): string {
    return `${this.getRemoteName(config)},root_folder_id=${folderId}:`;
  }

  /**
   * One rclone remote per distinct config (the name embeds a hash of it). A request always
   * runs on the remote built from its own config, so saving another config while requests
   * are in flight can no longer redirect them to a different bucket or provider.
   */
  private getRemoteName(config: S3Config): string {
    const hash = createHash("sha256").update(this.buildRemoteSignature(config)).digest("hex");
    return `${this.REMOTE_PREFIX}${this.isDrive(config) ? "gdrive" : "s3"}-${hash.slice(0, 10)}`;
  }

  private isDrive(config: S3Config): boolean {
    return config.provider === "GoogleDrive";
  }

  private getDriveCredentials(): { clientId: string; clientSecret: string } {
    const clientId = import.meta.env.MAIN_VITE_GDRIVE_CLIENT_ID;
    const clientSecret = import.meta.env.MAIN_VITE_GDRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ExternalServiceError(
        "Google Drive",
        "This build has no Google OAuth client configured (MAIN_VITE_GDRIVE_CLIENT_ID / MAIN_VITE_GDRIVE_CLIENT_SECRET)",
      );
    }

    return { clientId, clientSecret };
  }

  getRclonePath(): string {
    return this.RCLONE_PATH;
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

  private async deleteExistingRemote(remoteName: string): Promise<void> {
    try {
      await this.runRclone(["config", "delete", remoteName]);
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
      drive_token: config.drive_token,
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
