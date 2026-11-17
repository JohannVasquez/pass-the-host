import { ipcMain, IpcMainInvokeEvent, app } from "electron";
import * as path from "path";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  ReadLaunchJarUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "@main/contexts/server-runtime/application/use-cases";

export interface ServerOutputListener {
  onOutput(serverId: string, stream: "stdout" | "stderr", chunk: string): void;
  onExit(serverId: string, code: number | null): void;
}

export class ServerRuntimeIPCHandlers {
  constructor(
    private spawnServerProcessUseCase: SpawnServerProcessUseCase,
    private sendCommandUseCase: SendCommandUseCase,
    private killServerProcessUseCase: KillServerProcessUseCase,
    private readForgeJvmArgsUseCase: ReadForgeJvmArgsUseCase,
    private editForgeJvmArgsUseCase: EditForgeJvmArgsUseCase,
    private openServerFolderUseCase: OpenServerFolderUseCase,
    private readLaunchJarUseCase: ReadLaunchJarUseCase,
    private outputListener?: ServerOutputListener,
  ) {}

  /**
   * Wraps an IPC handler with error handling
   */
  private handleIPC<T extends unknown[], R>(
    context: string,
    handler: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await handler(...args);
      } catch (error) {
        ErrorHandler.handle(error, `ServerRuntimeIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }

  /** The listener must never break the console/exit flow. */
  private notify(fn: () => void): void {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }

  register(): void {
    // Get local server path
    ipcMain.handle("server:get-local-server-path", async (_event, serverId: string) => {
      const localServersDir = path.join(app.getPath("userData"), "servers");
      return path.join(localServersDir, serverId);
    });

    ipcMain.handle(
      "server:spawn-server-process",
      this.handleIPC(
        "spawnServerProcess",
        async (
          event: IpcMainInvokeEvent,
          serverId: string,
          command: string,
          args: string[],
          workingDir: string,
        ) => {
          await this.spawnServerProcessUseCase.execute(
            serverId,
            {
              command,
              args,
              workingDir,
              autoAcceptEula: true,
            },
            (data: string) => {
              this.notify(() => this.outputListener?.onOutput(serverId, "stdout", data));
              if (!event.sender.isDestroyed()) {
                event.sender.send("server:stdout", data);
              }
            },
            (data: string) => {
              this.notify(() => this.outputListener?.onOutput(serverId, "stderr", data));
              if (!event.sender.isDestroyed()) {
                event.sender.send("server:stdout", data);
              }
            },
            (code: number | null) => {
              this.notify(() => this.outputListener?.onExit(serverId, code));
              if (!event.sender.isDestroyed()) {
                event.sender.send("server:process-exit", { serverId, code });
              }
            },
          );
          return true;
        },
      ),
    );

    ipcMain.handle(
      "server:send-command",
      this.handleIPC("sendCommand", async (_event, serverId: string, command: string) => {
        return await this.sendCommandUseCase.execute(serverId, command);
      }),
    );

    ipcMain.handle(
      "server:kill-server-process",
      this.handleIPC("killServerProcess", async (_event, serverId: string) => {
        return await this.killServerProcessUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:read-forge-jvm-args",
      this.handleIPC("readForgeJvmArgs", async (_event, serverId: string) => {
        return await this.readForgeJvmArgsUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:read-launch-jar",
      this.handleIPC("readLaunchJar", async (_event, serverId: string) => {
        return await this.readLaunchJarUseCase.execute(serverId);
      }),
    );

    ipcMain.handle(
      "server:edit-forge-jvm-args",
      this.handleIPC(
        "editForgeJvmArgs",
        async (_event, serverId: string, minRam: number, maxRam: number) => {
          return await this.editForgeJvmArgsUseCase.execute(serverId, minRam, maxRam);
        },
      ),
    );

    ipcMain.handle(
      "server:openFolder",
      this.handleIPC("openFolder", async (_event, serverId: string) => {
        return await this.openServerFolderUseCase.execute(serverId);
      }),
    );
  }
}
