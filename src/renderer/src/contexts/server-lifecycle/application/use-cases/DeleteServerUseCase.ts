import { injectable, inject } from "inversify";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";
import { eventBus, ServerDeletedEvent } from "@shared/index";

/**
 * Use case for deleting a server
 */
@injectable()
export class DeleteServerUseCase {
  constructor(
    @inject(SERVER_LIFECYCLE_TYPES.ServerRepository)
    private readonly serverRepository: IServerRepository,
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID to delete
   * @param serverName Server name (for event)
   */
  async execute(serverId: string, serverName: string): Promise<void> {
    // Validate parameters
    if (!serverId || serverId.trim() === "") {
      throw new Error("Server ID is required");
    }

    // Check if server exists
    const server = await this.serverRepository.getServerById(serverId);
    if (!server) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    // Delete the server
    await this.serverRepository.deleteServer(serverId);

    // Publish domain event
    eventBus.publish(new ServerDeletedEvent(serverId, serverName));
  }
}
