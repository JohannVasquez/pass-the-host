import { injectable, inject } from "inversify";
import type { IServerRuntimeRepository } from "@server-runtime/domain/repositories/IServerRuntimeRepository";
import { SERVER_RUNTIME_TYPES } from "@shared/di/types";
import { eventBus, ServerStartedEvent, ServerStartingEvent } from "@shared/index";

/**
 * Use case for starting a Minecraft server
 */
@injectable()
export class StartServerUseCase {
  constructor(
    @inject(SERVER_RUNTIME_TYPES.ServerRuntimeRepository)
    private readonly runtimeRepository: IServerRuntimeRepository
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID to start
   */
  async execute(serverId: string): Promise<void> {
    if (!serverId || serverId.trim() === "") {
      throw new Error("Server ID is required");
    }

    // Publish starting event
    eventBus.publish(new ServerStartingEvent(serverId));

    try {
      await this.runtimeRepository.startServer(serverId);

      // Publish started event
      eventBus.publish(new ServerStartedEvent(serverId));
    } catch (error) {
      throw new Error(`Failed to start server: ${error}`);
    }
  }
}
