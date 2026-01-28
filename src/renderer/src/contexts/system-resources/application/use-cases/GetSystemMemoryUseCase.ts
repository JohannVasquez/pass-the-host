import { injectable, inject } from "inversify";
import type { ISystemResourcesRepository } from "../../domain/repositories";
import { SYSTEM_RESOURCES_TYPES } from "@shared/di";

/**
 * Get System Memory Use Case
 * Retrieves total system memory information
 */
@injectable()
export class GetSystemMemoryUseCase {
  constructor(
    @inject(SYSTEM_RESOURCES_TYPES.SystemResourcesRepository)
    private repository: ISystemResourcesRepository,
  ) {}

  async execute(): Promise<number> {
    return await this.repository.getTotalMemoryGB();
  }
}
