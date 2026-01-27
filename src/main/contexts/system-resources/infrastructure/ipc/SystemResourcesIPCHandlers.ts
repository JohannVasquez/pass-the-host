import { ipcMain } from "electron";
import { Container } from "inversify";
import { TYPES } from "../../application/use-cases/types";
import {
  EnsureJavaForMinecraftUseCase,
  GetInstalledJavaVersionsUseCase,
  GetRequiredJavaVersionUseCase,
  GetTotalMemoryUseCase,
  GetNetworkInterfacesUseCase,
} from "../../application/use-cases";

export function registerSystemResourcesIPCHandlers(container: Container): void {
  // Java handlers
  ipcMain.handle("java:ensure-for-minecraft", async (event, minecraftVersion: string) => {
    const useCase = container.get<EnsureJavaForMinecraftUseCase>(
      TYPES.EnsureJavaForMinecraftUseCase
    );
    const progressCallback = (message: string): void => {
      event.sender.send("java:progress", message);
    };
    return useCase.execute(minecraftVersion, progressCallback);
  });

  ipcMain.handle("java:get-installed-versions", async () => {
    const useCase = container.get<GetInstalledJavaVersionsUseCase>(
      TYPES.GetInstalledJavaVersionsUseCase
    );
    return useCase.execute();
  });

  ipcMain.handle("java:get-required-version", async (_, minecraftVersion: string) => {
    const useCase = container.get<GetRequiredJavaVersionUseCase>(
      TYPES.GetRequiredJavaVersionUseCase
    );
    return useCase.execute(minecraftVersion);
  });

  // System handlers
  ipcMain.handle("system:get-total-memory", async () => {
    const useCase = container.get<GetTotalMemoryUseCase>(TYPES.GetTotalMemoryUseCase);
    const result = useCase.execute();
    return result.totalGB; // Return just the number for backward compatibility
  });

  ipcMain.handle("system:get-network-interfaces", async () => {
    const useCase = container.get<GetNetworkInterfacesUseCase>(TYPES.GetNetworkInterfacesUseCase);
    return useCase.execute();
  });
}
