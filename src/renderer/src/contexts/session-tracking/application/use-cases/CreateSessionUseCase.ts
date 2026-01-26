import { injectable, inject } from 'inversify';
import type { ISessionRepository } from '../../domain/repositories';
import { SESSION_TRACKING_TYPES } from '@shared/di';
import { EventBus } from '@shared/infrastructure/event-bus';
import { SessionStartedEvent } from '@shared/domain/DomainEvents';

/**
 * Create Session Use Case
 * Creates a new session when a server starts
 */
@injectable()
export class CreateSessionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SESSION_TRACKING_TYPES.SessionRepository)
    private repository: ISessionRepository
  ) {}

  async execute(serverId: string, username: string): Promise<boolean> {
    if (!serverId || !username) {
      throw new Error('ServerId and username are required');
    }

    const success = await this.repository.createSession(serverId, username);

    if (success) {
      this.eventBus.publish(
        new SessionStartedEvent({
          serverId,
          username,
          timestamp: new Date(),
        })
      );
    }

    return success;
  }
}
