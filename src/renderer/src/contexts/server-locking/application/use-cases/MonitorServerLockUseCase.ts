import { injectable, inject } from "inversify";
import type { CheckServerLockUseCase } from "./CheckServerLockUseCase";
import type { S3Config } from "@cloud-storage/domain/entities";
import { SERVER_LOCKING_TYPES, SHARED_TYPES } from "@shared/di";
import { EventBus } from "@shared/infrastructure/event-bus";
import {
  ServerLockDetectedEvent,
  ServerLockCheckFailedEvent,
  ServerLockAvailableEvent,
} from "@shared/domain/DomainEvents";

/**
 * Monitor Server Lock Use Case
 * Periodically checks if a server is locked in S3-compatible storage
 * with exponential backoff on network errors
 */
@injectable()
export class MonitorServerLockUseCase {
  private intervalId: NodeJS.Timeout | null = null;
  private currentDelay: number = 10000; // Start with 10 seconds
  private baseDelay: number = 10000; // 10 seconds
  private readonly maxDelay: number = 300000; // 5 minutes
  private retryCount: number = 0;
  private lastLockState: boolean = false;

  constructor(
    @inject(SERVER_LOCKING_TYPES.CheckServerLockUseCase)
    private checkLockUseCase: CheckServerLockUseCase,
    @inject(SHARED_TYPES.EventBus)
    private eventBus: EventBus,
  ) {}

  /**
   * Start monitoring the lock status of a server
   * @param s3Config S3 configuration
   * @param serverId Server ID to monitor
   * @param intervalMs Base interval in milliseconds (default: 10000ms = 10s)
   */
  start(s3Config: S3Config, serverId: string, intervalMs: number = 10000): void {
    this.stop(); // Clear any existing interval

    this.baseDelay = intervalMs;
    this.currentDelay = intervalMs;
    this.retryCount = 0;
    this.lastLockState = false;

    // Immediate first check
    this.checkLock(s3Config, serverId);

    // Schedule periodic checks
    this.scheduleNextCheck(s3Config, serverId);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.currentDelay = this.baseDelay;
    this.retryCount = 0;
    this.lastLockState = false;
  }

  /**
   * Schedule the next lock check
   */
  private scheduleNextCheck(s3Config: S3Config, serverId: string): void {
    this.intervalId = setTimeout(() => {
      this.checkLock(s3Config, serverId);
      this.scheduleNextCheck(s3Config, serverId);
    }, this.currentDelay);
  }

  /**
   * Check the lock status and publish appropriate events
   */
  private async checkLock(s3Config: S3Config, serverId: string): Promise<void> {
    try {
      const result = await this.checkLockUseCase.execute(s3Config, serverId);

      // Reset delay on successful check
      if (this.retryCount > 0) {
        this.currentDelay = this.baseDelay;
        this.retryCount = 0;
      }

      // Check if lock state changed
      if (result.exists && result.lock) {
        // Server is locked
        if (!this.lastLockState) {
          // Lock was just detected
          this.eventBus.publish(
            new ServerLockDetectedEvent({
              serverId,
              username: result.lock.username,
              timestamp: new Date(result.lock.startedAt),
            }),
          );
        }
        this.lastLockState = true;
      } else {
        // Server is available
        if (this.lastLockState) {
          // Server was locked but now available
          this.eventBus.publish(
            new ServerLockAvailableEvent({
              serverId,
            }),
          );
        }
        this.lastLockState = false;
      }
    } catch (error) {
      // Handle network/check errors with exponential backoff
      this.retryCount++;

      // Calculate exponential backoff: baseDelay * 2^retryCount, capped at maxDelay
      this.currentDelay = Math.min(this.baseDelay * Math.pow(2, this.retryCount), this.maxDelay);

      const errorMessage = error instanceof Error ? error.message : String(error);

      this.eventBus.publish(
        new ServerLockCheckFailedEvent({
          serverId,
          error: errorMessage,
          retryDelay: this.currentDelay,
        }),
      );
    }
  }
}
