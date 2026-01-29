import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Container } from "inversify";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import { TYPES } from "../../application/use-cases/types";
import {
  CreateMinecraftServerUseCase,
  DeleteServerLocallyUseCase,
} from "../../application/use-cases";

export class ServerLifecycleIPCHandlers {
  constructor(private readonly container: Container) {}

  public register(): void {
    ipcMain.handle(
      "server:create-minecraft-server",
      this.handleIPC(
        "createMinecraftServer",
        async (
          event: IpcMainInvokeEvent,
          serverName: string,
          version: string,
          serverType: "vanilla" | "forge",
          overwrite?: boolean,
        ) => {
          const useCase = this.container.get<CreateMinecraftServerUseCase>(
            TYPES.CreateMinecraftServerUseCase,
          );
          const progressCallback = (message: string): void => {
            event.sender.send("server:create-progress", message);
          };
          return useCase.execute({ serverName, version, serverType, overwrite }, progressCallback);
        },
      ),
    );

    ipcMain.handle(
      "server:delete-locally",
      this.handleIPC("deleteLocally", async (_event, serverId) => {
        const useCase = this.container.get<DeleteServerLocallyUseCase>(
          TYPES.DeleteServerLocallyUseCase,
        );
        return useCase.execute(serverId);
      }),
    );
  }

  private handleIPC<T extends unknown[], R>(
    context: string,
    handler: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await handler(...args);
      } catch (error) {
        ErrorHandler.handle(error, `ServerLifecycleIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }
}

export function registerServerLifecycleIPCHandlers(container: Container): void {
  const handlers = new ServerLifecycleIPCHandlers(container);
  handlers.register();
}
