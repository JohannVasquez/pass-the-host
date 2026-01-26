import { injectable, inject } from 'inversify';
import type { ISessionRepository } from '../../domain/repositories';
import type { R2Config } from '@cloud-storage/domain/entities';
import { SESSION_TRACKING_TYPES } from '@shared/di';
import { EventBus } from '@shared/infrastructure/event-bus';
import { SessionUploadedEvent } from '@shared/domain/DomainEvents';

/**
 * Upload Session Use Case
 * Uploads session data to R2 storage
 */
@injectable()
export class UploadSessionUseCase {
  private eventBus = EventBus.getInstance();

  constructor(
    @inject(SESSION_TRACKING_TYPES.SessionRepository)
    private repository: ISessionRepository
  ) {}

  async execute(r2Config: R2Config, serverId: string): Promise<boolean> {
    if (!serverId) {
      throw new Error('ServerId is required');
    }

    const success = await this.repository.uploadSession(r2Config, serverId);

    if (success) {
      this.eventBus.publish(
        new SessionUploadedEvent({
          serverId,
        })
      );
    }

    return success;
  }
}
