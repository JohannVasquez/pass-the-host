import { injectable } from "inversify";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { app, shell } from "electron";
import { IServerProcessRepository } from "../../domain/repositories";
import { ServerProcess, ServerRuntimeConfig, ForgeJvmArgs } from "../../domain/entities";

@injectable()
export class ServerProcessRepository implements IServerProcessRepository {
  private serverProcesses: Map<string, ServerProcess> = new Map();

  async spawnProcess(
    serverId: string,
    config: ServerRuntimeConfig,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    onClose?: (code: number | null) => void
  ): Promise<ServerProcess> {
    return new Promise((resolve, reject) => {
      try {
        if (this.serverProcesses.has(serverId)) {
          return reject(new Error("Server process already running"));
        }

        // Auto accept EULA if enabled
        if (config.autoAcceptEula !== false) {
          const eulaPath = path.join(config.workingDir, "eula.txt");
          if (
            !fs.existsSync(eulaPath) ||
            !fs.readFileSync(eulaPath, "utf-8").includes("eula=true")
          ) {
            try {
              fs.writeFileSync(eulaPath, "eula=true");
            } catch {}
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
      } catch (e) {
        reject(e);
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
    try {
      const serverPath = this.getServerPath(serverId);

      // Determine which run script to parse based on platform
      const isWindows = process.platform === "win32";
      const runScriptPath = path.join(serverPath, isWindows ? "run.bat" : "run.sh");

      if (!fs.existsSync(runScriptPath)) {
        console.error(`Run script not found: ${runScriptPath}`);
        return null;
      }

      const runScriptContent = fs.readFileSync(runScriptPath, "utf-8");

      // Find all @filename.txt references in the run script
      const argFileMatches = runScriptContent.match(/@[^\s%]+\.txt/g);

      if (!argFileMatches || argFileMatches.length === 0) {
        console.error("No argument files found in run script");
        return null;
      }

      const allArgs: string[] = [];

      // Read each argument file referenced in the run script
      for (const argFileRef of argFileMatches) {
        const argFileName = argFileRef.substring(1);
        const argFilePath = path.join(serverPath, argFileName);

        if (!fs.existsSync(argFilePath)) {
          console.error(`Argument file not found: ${argFilePath}`);
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
    } catch (e) {
      console.error("Error reading Forge JVM args:", e);
      return null;
    }
  }

  async editForgeJvmArgs(serverId: string, minRam: number, maxRam: number): Promise<boolean> {
    try {
      const serverPath = this.getServerPath(serverId);
      const jvmArgsPath = path.join(serverPath, "user_jvm_args.txt");
      if (!fs.existsSync(jvmArgsPath)) return false;

      let content = fs.readFileSync(jvmArgsPath, "utf-8");
      content = content.replace(/-Xms\d+[mMgG]/g, `-Xms${minRam}G`);
      content = content.replace(/-Xmx\d+[mMgG]/g, `-Xmx${maxRam}G`);
      fs.writeFileSync(jvmArgsPath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  async openServerFolder(serverId: string): Promise<boolean> {
    try {
      const serverPath = this.getServerPath(serverId);

      if (!fs.existsSync(serverPath)) {
        console.error(`Server folder does not exist: ${serverPath}`);
        return false;
      }

      const errorMessage = await shell.openPath(serverPath);

      if (errorMessage) {
        console.error("Error opening folder:", errorMessage);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Exception opening folder:", error);
      return false;
    }
  }

  private getServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
