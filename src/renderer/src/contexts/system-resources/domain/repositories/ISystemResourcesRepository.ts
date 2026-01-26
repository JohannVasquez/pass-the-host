import type { SystemMemory, NetworkInterface } from "../entities";

/**
 * System Resources Repository interface
 * Defines operations for accessing system resources
 */
export interface ISystemResourcesRepository {
  /**
   * Gets total system memory in GB
   */
  getTotalMemoryGB(): Promise<number>;

  /**
   * Gets detailed system memory information
   */
  getSystemMemory(): Promise<SystemMemory>;

  /**
   * Gets all available network interfaces
   */
  getNetworkInterfaces(): Promise<NetworkInterface[]>;
}
