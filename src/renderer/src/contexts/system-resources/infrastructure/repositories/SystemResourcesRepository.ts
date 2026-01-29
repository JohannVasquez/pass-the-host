import { injectable } from "inversify";
import type { ISystemResourcesRepository } from "@system-resources/domain/repositories";
import type { SystemMemory, NetworkInterface } from "@system-resources/domain/entities";

/**
 * System Resources Repository implementation using IPC
 * Communicates with the main process for system information
 */
@injectable()
export class SystemResourcesRepository implements ISystemResourcesRepository {
  async getTotalMemoryGB(): Promise<number> {
    return await window.systemAPI.getTotalMemoryGB();
  }

  async getSystemMemory(): Promise<SystemMemory> {
    const totalGB = await window.systemAPI.getTotalMemoryGB();
    return {
      totalGB,
    };
  }

  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    return await window.systemAPI.getNetworkInterfaces();
  }
}
