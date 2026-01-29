import { ipcMain } from "electron";
import { Container } from "inversify";
import { ErrorHandler } from "@shared/infrastructure/error-handler";
import { TYPES } from "../../application/use-cases/types";
import {
  EnsureJavaForMinecraftUseCase,
  GetInstalledJavaVersionsUseCase,
  GetRequiredJavaVersionUseCase,
  GetTotalMemoryUseCase,
  GetNetworkInterfacesUseCase,
} from "../../application/use-cases";

export class SystemResourcesIPCHandlers {
  constructor(private readonly container: Container) {}

  public register(): void {
    // Java handlers
    ipcMain.handle(
      "java:ensure-for-minecraft",
      this.handleIPC("ensureJavaForMinecraft", async (event, minecraftVersion: string) => {
        const useCase = this.container.get<EnsureJavaForMinecraftUseCase>(
          TYPES.EnsureJavaForMinecraftUseCase,
        );
        const progressCallback = (message: string): void => {
          event.sender.send("java:progress", message);
        };
        return useCase.execute(minecraftVersion, progressCallback);
      }),
    );

    ipcMain.handle(
      "java:get-installed-versions",
      this.handleIPC("getInstalledVersions", async () => {
        const useCase = this.container.get<GetInstalledJavaVersionsUseCase>(
          TYPES.GetInstalledJavaVersionsUseCase,
        );
        return useCase.execute();
      }),
    );

    ipcMain.handle(
      "java:get-required-version",
      this.handleIPC("getRequiredVersion", async (_, minecraftVersion: string) => {
        const useCase = this.container.get<GetRequiredJavaVersionUseCase>(
          TYPES.GetRequiredJavaVersionUseCase,
        );
        return useCase.execute(minecraftVersion);
      }),
    );

    // System handlers
    ipcMain.handle(
      "system:get-total-memory",
      this.handleIPC("getTotalMemory", async () => {
        const useCase = this.container.get<GetTotalMemoryUseCase>(TYPES.GetTotalMemoryUseCase);
        const result = useCase.execute();
        return result.totalGB; // Return just the number for backward compatibility
      }),
    );

    ipcMain.handle(
      "system:get-network-interfaces",
      this.handleIPC("getNetworkInterfaces", async () => {
        const useCase = this.container.get<GetNetworkInterfacesUseCase>(
          TYPES.GetNetworkInterfacesUseCase,
        );
        return useCase.execute();
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
        ErrorHandler.handle(error, `SystemResourcesIPCHandlers.${context}`);
        throw ErrorHandler.serialize(error);
      }
    };
  }
}

export function registerSystemResourcesIPCHandlers(container: Container): void {
  const handlers = new SystemResourcesIPCHandlers(container);
  handlers.register();
}
