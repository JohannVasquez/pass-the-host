import EventEmitter from "eventemitter3";
import { DomainEvent } from "../../domain/DomainEvent";

/**
 * Event handler type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

/**
 * Event Bus implementation using EventEmitter3
 * Provides typed event publishing and subscription
 */
export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Get the singleton instance of EventBus
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish a domain event
   */
  public publish<T extends DomainEvent>(event: T): void {
    console.log(`[EventBus] Publishing event: ${event.eventName}`, {
      aggregateId: event.aggregateId,
      occurredOn: event.occurredOn,
    });

    // Emit to specific event name
    this.emitter.emit(event.eventName, event);

    // Also emit to wildcard for global listeners
    this.emitter.emit("*", event);
  }

  /**
   * Publish multiple domain events
   */
  public publishAll(events: DomainEvent[]): void {
    events.forEach((event) => this.publish(event));
  }

  /**
   * Subscribe to a specific event type
   */
  public subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.on(eventName, handler);
  }

  /**
   * Subscribe to a specific event type (one-time)
   */
  public subscribeOnce<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.once(eventName, handler);
  }

  /**
   * Subscribe to all events (wildcard)
   */
  public subscribeToAll(handler: EventHandler<DomainEvent>): void {
    this.emitter.on("*", handler);
  }

  /**
   * Unsubscribe from a specific event type
   */
  public unsubscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.off(eventName, handler);
  }

  /**
   * Unsubscribe from all events
   */
  public unsubscribeAll(eventName?: string): void {
    if (eventName) {
      this.emitter.removeAllListeners(eventName);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  public listenerCount(eventName: string): number {
    return this.emitter.listenerCount(eventName);
  }

  /**
   * Clear all event handlers (useful for testing)
   */
  public clear(): void {
    this.emitter.removeAllListeners();
  }
}

/**
 * Export singleton instance
 */
export const eventBus = EventBus.getInstance();
