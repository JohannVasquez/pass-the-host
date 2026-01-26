import { injectable, inject } from 'inversify';
import type { ISessionRepository } from '../../domain/repositories';
import type { ServerStatistics } from '../../domain/entities';
import { SESSION_TRACKING_TYPES } from '@shared/di';

/**
 * Get Server Statistics Use Case
 * Retrieves all statistics for a server including sessions
 */
@injectable()
export class GetServerStatisticsUseCase {
  constructor(
    @inject(SESSION_TRACKING_TYPES.SessionRepository)
    private repository: ISessionRepository
  ) {}

  async execute(serverId: string): Promise<ServerStatistics | null> {
    if (!serverId) {
      throw new Error('ServerId is required');
    }

    return await this.repository.getStatistics(serverId);
  }
}
