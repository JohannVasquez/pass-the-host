import { injectable } from "inversify";
import type { ISystemResourcesRepository } from "../../domain/repositories";
import type { SystemMemory, NetworkInterface } from "../../domain/entities";

/**
 * System Resources Repository implementation using IPC
 * Communicates with the main process for system information
 */
@injectable()
export class SystemResourcesRepository implements ISystemResourcesRepository {
  async getTotalMemoryGB(): Promise<number> {
    try {
      return await window.systemAPI.getTotalMemoryGB();
    } catch (error) {
      console.error("Error getting total memory:", error);
      return 0;
    }
  }

  async getSystemMemory(): Promise<SystemMemory> {
    try {
      const totalGB = await window.systemAPI.getTotalMemoryGB();
      return {
        totalGB,
      };
    } catch (error) {
      console.error("Error getting system memory:", error);
      return {
        totalGB: 0,
      };
    }
  }

  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    try {
      return await window.systemAPI.getNetworkInterfaces();
    } catch (error) {
      console.error("Error getting network interfaces:", error);
      return [];
    }
  }
}
