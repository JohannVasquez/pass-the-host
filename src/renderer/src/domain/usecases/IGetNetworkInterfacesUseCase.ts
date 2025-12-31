import { NetworkInterface } from "../entities/ServerConfig";

/**
 * Use case interface for retrieving network interfaces
 */
export interface IGetNetworkInterfacesUseCase {
  /**
   * Gets all available network interfaces on the system
   * @returns Promise with array of network interfaces
   */
  execute(): Promise<NetworkInterface[]>;
}
