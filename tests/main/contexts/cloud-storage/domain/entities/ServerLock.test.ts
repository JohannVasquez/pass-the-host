import { describe, it, expect } from "vitest";
import type { ServerLock } from "../../../../../../src/main/contexts/cloud-storage/domain/entities/ServerLock";

describe("ServerLock", () => {
  describe("interface", () => {
    it("should create an unlocked server state", () => {
      const lock: ServerLock = {
        exists: false,
      };

      expect(lock.exists).toBe(false);
      expect(lock.username).toBeUndefined();
      expect(lock.startedAt).toBeUndefined();
      expect(lock.timestamp).toBeUndefined();
    });

    it("should create a locked server state", () => {
      const lock: ServerLock = {
        exists: true,
        username: "player123",
        startedAt: "2024-01-15T10:30:00.000Z",
        timestamp: 1705315800000,
      };

      expect(lock.exists).toBe(true);
      expect(lock.username).toBe("player123");
      expect(lock.startedAt).toBe("2024-01-15T10:30:00.000Z");
      expect(lock.timestamp).toBe(1705315800000);
    });

    it("should support partial lock info (exists with username only)", () => {
      const lock: ServerLock = {
        exists: true,
        username: "testuser",
      };

      expect(lock.exists).toBe(true);
      expect(lock.username).toBe("testuser");
      expect(lock.startedAt).toBeUndefined();
      expect(lock.timestamp).toBeUndefined();
    });

    it("should support different username formats", () => {
      const locks: ServerLock[] = [
        { exists: true, username: "simple_name" },
        { exists: true, username: "Player123" },
        { exists: true, username: "user-with-dash" },
        { exists: true, username: "user.with.dots" },
      ];

      expect(locks[0].username).toBe("simple_name");
      expect(locks[1].username).toBe("Player123");
      expect(locks[2].username).toBe("user-with-dash");
      expect(locks[3].username).toBe("user.with.dots");
    });

    it("should support ISO date string formats", () => {
      const lock: ServerLock = {
        exists: true,
        username: "player",
        startedAt: "2024-12-25T23:59:59.999Z",
        timestamp: Date.parse("2024-12-25T23:59:59.999Z"),
      };

      expect(lock.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(lock.timestamp).toBe(Date.parse(lock.startedAt as string));
    });
  });
});
