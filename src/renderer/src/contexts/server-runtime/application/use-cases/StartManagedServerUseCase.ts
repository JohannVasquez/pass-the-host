import type { LogEntry } from "@renderer/domain/entities/LogEntry";
import type { S3Config } from "@renderer/domain/entities/ServerConfig";
import { ServerType, type Server } from "@renderer/domain/entities/Server";
import { ServerStatus } from "@renderer/domain/entities/ServerStatus";

type LogType = LogEntry["type"];

export interface StartManagedServerRequest {
  serverId: string;
  username: string;
  server: Server;
  serverPort: number;
  s3Config: S3Config;
  ramConfig: {
    min: number;
    max: number;
  };
  isCloudSyncEnabled: boolean;
  isWindowsClient: boolean;
}

export interface StartManagedServerDependencies {
  readLock(config: S3Config, serverId: string): Promise<{
    exists: boolean;
    username?: string;
    startedAt?: string;
  }>;
  shouldDownload(config: S3Config, serverId: string): Promise<boolean>;
  downloadServer(serverId: string): Promise<boolean>;
  writePort(serverId: string, port: number): Promise<boolean>;
  ensureJavaForMinecraft(version: string): Promise<{
    success: boolean;
    javaPath: string;
    version?: string;
  }>;
  createLock(serverId: string, username: string): Promise<boolean>;
  uploadLock(config: S3Config, serverId: string): Promise<boolean>;
  createSession(serverId: string, username: string): Promise<boolean>;
  getLocalServerPath(serverId: string): Promise<string>;
  editForgeJvmArgs(serverId: string, minRam: number, maxRam: number): Promise<boolean>;
  readForgeJvmArgs(serverId: string): Promise<{ allArgs: string[] } | null>;
  spawnServerProcess(
    serverId: string,
    command: string,
    args: string[],
    workingDir: string,
  ): Promise<boolean>;
}

export interface StartManagedServerPresenter {
  log(message: string, type: LogType): void;
  updateStatus(next: ServerStatus, reason: string, options?: { force?: boolean }): void;
  setLockedServerInfo(info: { username: string; startedAt: string }): void;
  openServerLockedModal(): void;
  startTransfer(type: "download" | "upload", transferred?: string, total?: string): void;
  stopTransfer(): void;
  setJavaProgress(active: boolean, message: string): void;
  setServerStartTime(startTime: Date | null): void;
}

export class StartManagedServerUseCase {
  constructor(
    private readonly dependencies: StartManagedServerDependencies,
    private readonly presenter: StartManagedServerPresenter,
  ) {}

  async execute(request: StartManagedServerRequest): Promise<void> {
    this.presenter.updateStatus(ServerStatus.STARTING, "start flow initiated");
    this.presenter.log(`Starting server: ${request.serverId}`, "info");

    await this.ensureServerUnlocked(request);
    await this.ensureLocalFilesReady(request);
    await this.tryConfigureServerPort(request);
    const javaPath = await this.ensureJavaReady(request.server.version);
    await this.createServerLock(request);
    await this.createSession(request);

    const localServerPath = await this.dependencies.getLocalServerPath(request.serverId);
    const { command, args } = await this.buildStartCommand(request, javaPath);
    const success = await this.dependencies.spawnServerProcess(
      request.serverId,
      command,
      args,
      localServerPath,
    );

    if (!success) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "process spawn failed");
      throw new Error("Server process could not be started");
    }

    this.presenter.log("Server started successfully", "info");
    this.presenter.setServerStartTime(new Date());
    this.presenter.updateStatus(ServerStatus.RUNNING, "process spawn succeeded");
  }

  private async ensureServerUnlocked(request: StartManagedServerRequest): Promise<void> {
    this.presenter.log("Checking server lock status...", "info");

    if (!request.isCloudSyncEnabled) {
      return;
    }

    const lockInfo = await this.dependencies.readLock(request.s3Config, request.serverId);

    if (!lockInfo.exists) {
      return;
    }

    this.presenter.log(`Server is locked by ${lockInfo.username}`, "error");
    this.presenter.setLockedServerInfo({
      username: lockInfo.username || "Unknown",
      startedAt: lockInfo.startedAt || new Date().toISOString(),
    });
    this.presenter.openServerLockedModal();
    this.presenter.updateStatus(ServerStatus.STOPPED, "remote lock detected");
    throw new Error("Server is locked remotely");
  }

  private async ensureLocalFilesReady(request: StartManagedServerRequest): Promise<void> {
    this.presenter.log("Checking server files...", "info");

    if (!request.isCloudSyncEnabled) {
      this.presenter.log("Local server files are up to date, skipping download", "info");
      return;
    }

    const shouldDownload = await this.dependencies.shouldDownload(request.s3Config, request.serverId);

    if (!shouldDownload) {
      this.presenter.log("Local server files are up to date, skipping download", "info");
      return;
    }

    this.presenter.log("Downloading server files from cloud storage...", "info");
    this.presenter.startTransfer("download");

    try {
      const downloadSuccess = await this.dependencies.downloadServer(request.serverId);

      if (!downloadSuccess) {
        this.presenter.updateStatus(ServerStatus.STOPPED, "download failed");
        throw new Error("Failed to download server files");
      }

      this.presenter.log("Server files downloaded successfully", "info");
    } finally {
      this.presenter.stopTransfer();
    }
  }

  private async tryConfigureServerPort(request: StartManagedServerRequest): Promise<void> {
    try {
      const portUpdateSuccess = await this.dependencies.writePort(request.serverId, request.serverPort);

      if (portUpdateSuccess) {
        this.presenter.log(`Server port configured to ${request.serverPort}`, "info");
      }
    } catch {
      this.presenter.log("Error updating server port", "warning");
    }
  }

  private async ensureJavaReady(version: string): Promise<string> {
    this.presenter.log(`Checking Java requirements for Minecraft ${version}...`, "info");
    this.presenter.setJavaProgress(true, "Checking Java requirements...");

    try {
      const javaResult = await this.dependencies.ensureJavaForMinecraft(version);

      if (!javaResult.success || !javaResult.javaPath) {
        this.presenter.updateStatus(ServerStatus.STOPPED, "java setup failed");
        throw new Error("Failed to setup Java. Server may not start correctly.");
      }

      this.presenter.log(`Java ${javaResult.version || "runtime"} is ready`, "info");
      return javaResult.javaPath;
    } catch (error) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "java setup error");
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      this.presenter.setJavaProgress(false, "");
    }
  }

  private async createServerLock(request: StartManagedServerRequest): Promise<void> {
    this.presenter.log("Creating server lock...", "info");
    const lockSuccess = await this.dependencies.createLock(request.serverId, request.username);

    if (!lockSuccess) {
      this.presenter.log("Warning: Failed to create server lock", "warning");
      return;
    }

    this.presenter.log(`Server locked by: ${request.username}`, "info");

    if (!request.isCloudSyncEnabled) {
      return;
    }

    this.presenter.log("Uploading lock to cloud storage...", "info");
    const uploadLockSuccess = await this.dependencies.uploadLock(request.s3Config, request.serverId);

    if (uploadLockSuccess) {
      this.presenter.log("Lock uploaded to cloud storage", "info");
      return;
    }

    this.presenter.log("Warning: Failed to upload lock to cloud storage", "warning");
  }

  private async createSession(request: StartManagedServerRequest): Promise<void> {
    this.presenter.log("Creating session metadata...", "info");
    const sessionCreateSuccess = await this.dependencies.createSession(request.serverId, request.username);

    if (sessionCreateSuccess) {
      this.presenter.log(`Session created for user: ${request.username}`, "info");
    }
  }

  private async buildStartCommand(
    request: StartManagedServerRequest,
    javaPath: string,
  ): Promise<{ command: string; args: string[] }> {
    if (request.server.type === ServerType.VANILLA) {
      return {
        command: javaPath,
        args: [
          `-Xmx${request.ramConfig.max}G`,
          `-Xms${request.ramConfig.min}G`,
          "-jar",
          "server.jar",
          "nogui",
        ],
      };
    }

    if (request.server.type !== ServerType.FORGE && request.server.type !== ServerType.NEOFORGE) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "unsupported server type");
      throw new Error(`Tipo de server no soportado: ${request.server.type}`);
    }

    const versionNum = parseFloat(request.server.version);
    if (request.server.type === ServerType.FORGE && versionNum < 1.17) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "unsupported forge version");
      throw new Error("No se pudo iniciar el server Forge <= 1.16.5. No soportado.");
    }

    try {
      await this.dependencies.editForgeJvmArgs(
        request.serverId,
        request.ramConfig.min,
        request.ramConfig.max,
      );
    } catch {
      this.presenter.log("No se pudo editar user_jvm_args.txt", "error");
    }

    try {
      const jvmArgsResult = await this.dependencies.readForgeJvmArgs(request.serverId);

      if (jvmArgsResult?.allArgs && jvmArgsResult.allArgs.length > 0) {
        return {
          command: javaPath,
          args: [...jvmArgsResult.allArgs, "nogui"],
        };
      }

      this.presenter.log(
        "Warning: Could not read run.bat arguments, falling back to run.bat execution",
        "warning",
      );

      return request.isWindowsClient
        ? { command: "cmd", args: ["/c", "run.bat"] }
        : { command: "/bin/bash", args: ["run.sh"] };
    } catch (error) {
      this.presenter.updateStatus(ServerStatus.STOPPED, "failed reading forge jvm args");
      throw new Error(
        `Error reading JVM args: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
