import { injectable, inject } from "inversify";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import type { Server } from "@server-lifecycle/domain/entities/Server";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";

/**
 * Use case for getting server details by ID
 */
@injectable()
export class GetServerDetailsUseCase {
  constructor(
    @inject(SERVER_LIFECYCLE_TYPES.ServerRepository)
    private readonly serverRepository: IServerRepository,
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID
   * @returns Promise with server or null if not found
   */
  async execute(serverId: string): Promise<Server | null> {
    if (!serverId || serverId.trim() === "") {
      throw new Error("Server ID is required");
    }

    const server = await this.serverRepository.getServerById(serverId);
    return server;
  }
}
