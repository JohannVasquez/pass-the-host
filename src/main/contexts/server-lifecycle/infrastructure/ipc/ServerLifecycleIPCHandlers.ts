import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Container } from "inversify";
import { TYPES } from "../../application/use-cases/types";
import {
  CreateMinecraftServerUseCase,
  DeleteServerLocallyUseCase,
} from "../../application/use-cases";

export function registerServerLifecycleIPCHandlers(container: Container): void {
  ipcMain.handle(
    "server:create-minecraft-server",
    async (
      event: IpcMainInvokeEvent,
      serverName: string,
      version: string,
      serverType: "vanilla" | "forge"
    ) => {
      const useCase = container.get<CreateMinecraftServerUseCase>(
        TYPES.CreateMinecraftServerUseCase
      );
      const progressCallback = (message: string): void => {
        event.sender.send("server:create-progress", message);
      };
      return useCase.execute({ serverName, version, serverType }, progressCallback);
    }
  );

  ipcMain.handle("server:delete-locally", async (_event, serverId) => {
    const useCase = container.get<DeleteServerLocallyUseCase>(TYPES.DeleteServerLocallyUseCase);
    return useCase.execute(serverId);
  });
}
