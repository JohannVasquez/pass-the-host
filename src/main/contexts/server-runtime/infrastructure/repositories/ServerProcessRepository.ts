import { injectable } from "inversify";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { app, shell } from "electron";
import { IServerProcessRepository } from "../../domain/repositories";
import { ServerProcess, ServerRuntimeConfig, ForgeJvmArgs } from "../../domain/entities";
import { ProcessError, FileSystemError, NotFoundError } from "@shared/domain/errors";

@injectable()
export class ServerProcessRepository implements IServerProcessRepository {
  private serverProcesses: Map<string, ServerProcess> = new Map();

  async spawnProcess(
    serverId: string,
    config: ServerRuntimeConfig,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    onClose?: (code: number | null) => void,
  ): Promise<ServerProcess> {
    if (this.serverProcesses.has(serverId)) {
      throw new ProcessError(`Server process already running for ${serverId}`);
    }

    return new Promise((resolve) => {
      try {
        // Auto accept EULA if enabled
        if (config.autoAcceptEula !== false) {
          const eulaPath = path.join(config.workingDir, "eula.txt");
          if (
            !fs.existsSync(eulaPath) ||
            !fs.readFileSync(eulaPath, "utf-8").includes("eula=true")
          ) {
            try {
              fs.writeFileSync(eulaPath, "eula=true");
            } catch {
              // Ignore EULA write errors
            }
          }
        }

        const proc = spawn(config.command, config.args, {
          cwd: config.workingDir,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });

        const serverProcess = new ServerProcess(serverId, proc);
        this.serverProcesses.set(serverId, serverProcess);

        proc.stdout.on("data", (data) => {
          onStdout?.(data.toString());
        });

        proc.stderr.on("data", (data) => {
          onStderr?.(data.toString());
        });

        proc.on("close", (code) => {
          this.serverProcesses.delete(serverId);
          onClose?.(code);
        });

        resolve(serverProcess);
      } catch (error) {
        throw new ProcessError(
          `Failed to spawn server process for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  getProcess(serverId: string): ServerProcess | null {
    return this.serverProcesses.get(serverId) || null;
  }

  async sendCommand(serverId: string, command: string): Promise<boolean> {
    const proc = this.getProcess(serverId);
    if (!proc) return false;
    return proc.sendCommand(command);
  }

  async killProcess(serverId: string): Promise<boolean> {
    const proc = this.getProcess(serverId);
    if (!proc) return false;

    const result = await proc.stop();
    this.serverProcesses.delete(serverId);
    return result;
  }

  async readForgeJvmArgs(serverId: string): Promise<ForgeJvmArgs | null> {
    const serverPath = this.getServerPath(serverId);

    // Determine which run script to parse based on platform
    const isWindows = process.platform === "win32";
    const runScriptPath = path.join(serverPath, isWindows ? "run.bat" : "run.sh");

    // Expected case: run script doesn't exist (not a Forge server)
    if (!fs.existsSync(runScriptPath)) {
      return null;
    }

    try {
      const runScriptContent = fs.readFileSync(runScriptPath, "utf-8");

      // Find all @filename.txt references in the run script
      const argFileMatches = runScriptContent.match(/@[^\s%]+\.txt/g);

      if (!argFileMatches || argFileMatches.length === 0) {
        return null;
      }

      const allArgs: string[] = [];

      // Read each argument file referenced in the run script
      for (const argFileRef of argFileMatches) {
        const argFileName = argFileRef.substring(1);
        const argFilePath = path.join(serverPath, argFileName);

        if (!fs.existsSync(argFilePath)) {
          continue;
        }

        const fileContent = fs.readFileSync(argFilePath, "utf-8");
        const lines = fileContent.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith("#")) continue;

          // Split by spaces and add each non-empty argument
          const lineArgs = trimmed.split(/\s+/).filter((arg) => arg.length > 0);
          allArgs.push(...lineArgs);
        }
      }

      return allArgs.length > 0 ? { allArgs } : null;
    } catch (error) {
      // Unexpected error reading/parsing Forge args
      throw new FileSystemError(
        `Failed to read Forge JVM args for server ${serverId}`,
        "FILESYSTEM_ERROR",
        error,
      );
    }
  }

  async editForgeJvmArgs(serverId: string, minRam: number, maxRam: number): Promise<boolean> {
    const serverPath = this.getServerPath(serverId);
    const jvmArgsPath = path.join(serverPath, "user_jvm_args.txt");

    // Expected case: file doesn't exist
    if (!fs.existsSync(jvmArgsPath)) {
      return false;
    }

    try {
      let content = fs.readFileSync(jvmArgsPath, "utf-8");
      content = content.replace(/-Xms\d+[mMgG]/g, `-Xms${minRam}G`);
      content = content.replace(/-Xmx\d+[mMgG]/g, `-Xmx${maxRam}G`);
      fs.writeFileSync(jvmArgsPath, content, "utf-8");
      return true;
    } catch (error) {
      // Unexpected error reading/writing file
      throw new FileSystemError(
        `Failed to edit Forge JVM args for server ${serverId}`,
        "FILESYSTEM_ERROR",
        error,
      );
    }
  }

  async openServerFolder(serverId: string): Promise<boolean> {
    const serverPath = this.getServerPath(serverId);

    if (!fs.existsSync(serverPath)) {
      throw new NotFoundError("Server folder", serverId);
    }

    const errorMessage = await shell.openPath(serverPath);

    if (errorMessage) {
      throw new FileSystemError(`Failed to open server folder: ${errorMessage}`);
    }

    return true;
  }

  private getServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
