import { ipcMain, IpcMainInvokeEvent, app } from "electron";
import * as path from "path";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "../../application/use-cases";

export class ServerRuntimeIPCHandlers {
  constructor(
    private spawnServerProcessUseCase: SpawnServerProcessUseCase,
    private sendCommandUseCase: SendCommandUseCase,
    private killServerProcessUseCase: KillServerProcessUseCase,
    private readForgeJvmArgsUseCase: ReadForgeJvmArgsUseCase,
    private editForgeJvmArgsUseCase: EditForgeJvmArgsUseCase,
    private openServerFolderUseCase: OpenServerFolderUseCase,
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
              if (!event.sender.isDestroyed()) {
                event.sender.send("server:stdout", data);
              }
            },
            (data: string) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send("server:stdout", data);
              }
            },
            () => {
              // Process closed
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
