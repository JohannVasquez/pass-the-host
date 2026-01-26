import { injectable, inject } from 'inversify'
import type { IServerRuntimeRepository } from '@server-runtime/domain/repositories/IServerRuntimeRepository'
import { SERVER_RUNTIME_TYPES } from '@shared/di/types'
import { eventBus, ServerStoppedEvent, ServerStoppingEvent } from '@shared/index'

/**
 * Use case for stopping a Minecraft server
 */
@injectable()
export class StopServerUseCase {
  constructor(
    @inject(SERVER_RUNTIME_TYPES.ServerRuntimeRepository)
    private readonly runtimeRepository: IServerRuntimeRepository
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID to stop
   */
  async execute(serverId: string): Promise<void> {
    if (!serverId || serverId.trim() === '') {
      throw new Error('Server ID is required')
    }

    // Publish stopping event
    eventBus.publish(new ServerStoppingEvent(serverId))

    try {
      await this.runtimeRepository.stopServer(serverId)

      // Publish stopped event
      eventBus.publish(new ServerStoppedEvent(serverId))
    } catch (error) {
      throw new Error(`Failed to stop server: ${error}`)
    }
  }
}
