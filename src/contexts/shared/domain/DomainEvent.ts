/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly aggregateId?: string;
}

/**
 * Base class for domain events
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly aggregateId?: string;

  constructor(aggregateId?: string) {
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
  }

  abstract get eventName(): string;
}
