import { describe, it, expect } from "vitest";
import { BaseDomainEvent } from "../../../../src/contexts/shared/domain/DomainEvent";

class TestEvent extends BaseDomainEvent {
  constructor(
    public readonly testData: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "test.event";
  }
}

describe("DomainEvent", () => {
  describe("BaseDomainEvent", () => {
    it("should create event with occurredOn timestamp", () => {
      const before = new Date();
      const event = new TestEvent("test-data");
      const after = new Date();

      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.occurredOn.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredOn.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should create event with aggregateId when provided", () => {
      const event = new TestEvent("test-data", "aggregate-123");

      expect(event.aggregateId).toBe("aggregate-123");
    });

    it("should create event without aggregateId when not provided", () => {
      const event = new TestEvent("test-data");

      expect(event.aggregateId).toBeUndefined();
    });

    it("should return correct eventName", () => {
      const event = new TestEvent("test-data");

      expect(event.eventName).toBe("test.event");
    });

    it("should store custom data", () => {
      const event = new TestEvent("my-custom-data", "agg-1");

      expect(event.testData).toBe("my-custom-data");
    });
  });
});
