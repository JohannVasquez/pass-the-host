import { injectable, inject } from "inversify";
import type { IServerRepository } from "@server-lifecycle/domain/repositories/IServerRepository";
import type { Server, CreateServerParams } from "@server-lifecycle/domain/entities/Server";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";
import { eventBus, ServerCreatedEvent } from "@shared/index";

/**
 * Use case for creating a new Minecraft server
 */
@injectable()
export class CreateServerUseCase {
  constructor(
    @inject(SERVER_LIFECYCLE_TYPES.ServerRepository)
    private readonly serverRepository: IServerRepository
  ) {}

  /**
   * Execute the use case
   * @param params Server creation parameters
   * @returns Promise with created server
   */
  async execute(params: CreateServerParams): Promise<Server> {
    // Validate parameters
    if (!params.name || params.name.trim() === "") {
      throw new Error("Server name is required");
    }

    if (!params.version || params.version.trim() === "") {
      throw new Error("Server version is required");
    }

    if (params.type !== "vanilla" && params.type !== "forge") {
      throw new Error("Server type must be vanilla or forge");
    }

    // Create the server
    const server = await this.serverRepository.createServer(
      params.name,
      params.version,
      params.type
    );

    // Publish domain event
    eventBus.publish(new ServerCreatedEvent(server.id, server.name, server.type));

    return server;
  }
}
