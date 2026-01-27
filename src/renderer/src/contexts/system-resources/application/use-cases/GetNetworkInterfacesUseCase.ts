import { injectable, inject } from "inversify";
import type { ISystemResourcesRepository } from "../../domain/repositories";
import type { NetworkInterface } from "../../domain/entities";
import { SYSTEM_RESOURCES_TYPES } from "@shared/di";

/**
 * Get Network Interfaces Use Case
 * Retrieves all available network interfaces on the system
 */
@injectable()
export class GetNetworkInterfacesUseCase {
  constructor(
    @inject(SYSTEM_RESOURCES_TYPES.SystemResourcesRepository)
    private repository: ISystemResourcesRepository
  ) {}

  async execute(): Promise<NetworkInterface[]> {
    return await this.repository.getNetworkInterfaces();
  }
}
