import { injectable, inject } from "inversify";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import type { Server } from "@server-lifecycle/domain/entities/Server";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";

/**
 * Use case for listing all available servers
 */
@injectable()
export class ListServersUseCase {
  constructor(
    @inject(SERVER_LIFECYCLE_TYPES.ServerRepository)
    private readonly serverRepository: IServerRepository,
  ) {}

  /**
   * Execute the use case
   * @returns Promise with array of servers
   */
  async execute(): Promise<Server[]> {
    const servers = await this.serverRepository.getServers();
    return servers;
  }
}
