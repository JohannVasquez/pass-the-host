import { injectable, inject } from 'inversify';
import type { ISessionRepository } from '../../domain/repositories';
import { SESSION_TRACKING_TYPES } from '@shared/di';
import { EventBus } from '@shared/infrastructure/event-bus';
import { SessionEndedEvent } from '@shared/domain/DomainEvents';

/**
 * End Session Use Case
 * Ends the current session when a server stops
 */
@injectable()
export class EndSessionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SESSION_TRACKING_TYPES.SessionRepository)
    private repository: ISessionRepository
  ) {}

  async execute(serverId: string, username: string): Promise<boolean> {
    if (!serverId || !username) {
      throw new Error('ServerId and username are required');
    }

    const success = await this.repository.updateSession(serverId, username);

    if (success) {
      this.eventBus.publish(
        new SessionEndedEvent({
          serverId,
          username,
          timestamp: new Date(),
        })
      );
    }

    return success;
  }
}
