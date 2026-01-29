import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../../../src/contexts/shared/infrastructure/event-bus/EventBus";
import { BaseDomainEvent } from "../../../../../src/contexts/shared/domain/DomainEvent";

class TestEvent extends BaseDomainEvent {
  constructor(
    public readonly data: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "test.event";
  }
}

class AnotherTestEvent extends BaseDomainEvent {
  constructor(public readonly value: number) {
    super();
  }

  get eventName(): string {
    return "another.test.event";
  }
}

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Get singleton instance and clear all listeners before each test
    eventBus = EventBus.getInstance();
    eventBus.clear();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = EventBus.getInstance();
      const instance2 = EventBus.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("publish", () => {
    it("should publish event to subscribers", () => {
      const handler = vi.fn();
      eventBus.subscribe("test.event", handler);

      const event = new TestEvent("test-data");
      eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should publish event to wildcard subscribers", () => {
      const wildcardHandler = vi.fn();
      eventBus.subscribeToAll(wildcardHandler);

      const event = new TestEvent("test-data");
      eventBus.publish(event);

      expect(wildcardHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledWith(event);
    });

    it("should not call handlers for different event types", () => {
      const handler = vi.fn();
      eventBus.subscribe("other.event", handler);

      const event = new TestEvent("test-data");
      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("publishAll", () => {
    it("should publish multiple events", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test.event", handler1);
      eventBus.subscribe("another.test.event", handler2);

      const events = [new TestEvent("data"), new AnotherTestEvent(42)];
      eventBus.publishAll(events);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe", () => {
    it("should add event handler", () => {
      const handler = vi.fn();
      eventBus.subscribe("test.event", handler);

      expect(eventBus.listenerCount("test.event")).toBe(1);
    });

    it("should allow multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test.event", handler1);
      eventBus.subscribe("test.event", handler2);

      expect(eventBus.listenerCount("test.event")).toBe(2);

      const event = new TestEvent("data");
      eventBus.publish(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribeOnce", () => {
    it("should only call handler once", () => {
      const handler = vi.fn();
      eventBus.subscribeOnce("test.event", handler);

      const event1 = new TestEvent("data1");
      const event2 = new TestEvent("data2");
      eventBus.publish(event1);
      eventBus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });
  });

  describe("unsubscribe", () => {
    it("should remove specific handler", () => {
      const handler = vi.fn();
      eventBus.subscribe("test.event", handler);
      eventBus.unsubscribe("test.event", handler);

      const event = new TestEvent("data");
      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should only remove specified handler", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test.event", handler1);
      eventBus.subscribe("test.event", handler2);
      eventBus.unsubscribe("test.event", handler1);

      const event = new TestEvent("data");
      eventBus.publish(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("unsubscribeAll", () => {
    it("should remove all handlers for specific event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test.event", handler1);
      eventBus.subscribe("test.event", handler2);
      eventBus.unsubscribeAll("test.event");

      expect(eventBus.listenerCount("test.event")).toBe(0);
    });

    it("should remove all handlers when no event specified", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe("test.event", handler1);
      eventBus.subscribe("another.event", handler2);
      eventBus.unsubscribeAll();

      expect(eventBus.listenerCount("test.event")).toBe(0);
      expect(eventBus.listenerCount("another.event")).toBe(0);
    });
  });

  describe("listenerCount", () => {
    it("should return correct count", () => {
      expect(eventBus.listenerCount("test.event")).toBe(0);

      eventBus.subscribe("test.event", vi.fn());
      expect(eventBus.listenerCount("test.event")).toBe(1);

      eventBus.subscribe("test.event", vi.fn());
      expect(eventBus.listenerCount("test.event")).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all handlers", () => {
      eventBus.subscribe("test.event", vi.fn());
      eventBus.subscribe("another.event", vi.fn());
      eventBus.subscribeToAll(vi.fn());

      eventBus.clear();

      expect(eventBus.listenerCount("test.event")).toBe(0);
      expect(eventBus.listenerCount("another.event")).toBe(0);
      expect(eventBus.listenerCount("*")).toBe(0);
    });
  });
});
