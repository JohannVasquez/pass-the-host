import { injectable, inject } from 'inversify'
import type { IServerRuntimeRepository } from '@server-runtime/domain/repositories/IServerRuntimeRepository'
import { SERVER_RUNTIME_TYPES } from '@shared/di/types'
import { eventBus, ServerCommandExecutedEvent } from '@shared/index'

/**
 * Use case for executing commands on a running server
 */
@injectable()
export class ExecuteCommandUseCase {
  constructor(
    @inject(SERVER_RUNTIME_TYPES.ServerRuntimeRepository)
    private readonly runtimeRepository: IServerRuntimeRepository
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID
   * @param command Command to execute
   */
  async execute(serverId: string, command: string): Promise<void> {
    if (!serverId || serverId.trim() === '') {
      throw new Error('Server ID is required')
    }

    if (!command || command.trim() === '') {
      throw new Error('Command is required')
    }

    try {
      await this.runtimeRepository.executeCommand(serverId, command)

      // Publish command executed event
      eventBus.publish(new ServerCommandExecutedEvent(serverId, command))
    } catch (error) {
      throw new Error(`Failed to execute command: ${error}`)
    }
  }
}
