import { injectable, inject } from 'inversify'
import type { IServerRuntimeRepository } from '@server-runtime/domain/repositories/IServerRuntimeRepository'
import type { ServerStatus } from '@server-runtime/domain/entities/ServerStatus'
import { SERVER_RUNTIME_TYPES } from '@shared/di/types'

/**
 * Use case for getting server status
 */
@injectable()
export class GetServerStatusUseCase {
  constructor(
    @inject(SERVER_RUNTIME_TYPES.ServerRuntimeRepository)
    private readonly runtimeRepository: IServerRuntimeRepository
  ) {}

  /**
   * Execute the use case
   * @param serverId Server ID
   * @returns Promise with server status
   */
  async execute(serverId: string): Promise<ServerStatus> {
    if (!serverId || serverId.trim() === '') {
      throw new Error('Server ID is required')
    }

    return await this.runtimeRepository.getServerStatus(serverId)
  }
}
