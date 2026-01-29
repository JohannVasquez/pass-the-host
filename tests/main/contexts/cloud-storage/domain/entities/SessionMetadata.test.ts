import { describe, it, expect } from "vitest";
import type {
  SessionEntry,
  SessionMetadata,
  ServerStatistics,
} from "../../../../../../src/main/contexts/cloud-storage/domain/entities/SessionMetadata";

describe("SessionEntry", () => {
  describe("interface", () => {
    it("should create an active session (no end time)", () => {
      const session: SessionEntry = {
        username: "player1",
        startTime: "2024-01-15T10:00:00.000Z",
        startTimestamp: 1705312800000,
      };

      expect(session.username).toBe("player1");
      expect(session.startTime).toBe("2024-01-15T10:00:00.000Z");
      expect(session.startTimestamp).toBe(1705312800000);
      expect(session.endTime).toBeUndefined();
      expect(session.endTimestamp).toBeUndefined();
      expect(session.duration).toBeUndefined();
    });

    it("should create a completed session", () => {
      const session: SessionEntry = {
        username: "player1",
        startTime: "2024-01-15T10:00:00.000Z",
        startTimestamp: 1705312800000,
        endTime: "2024-01-15T12:30:00.000Z",
        endTimestamp: 1705321800000,
        duration: 9000000, // 2.5 hours in ms
      };

      expect(session.endTime).toBe("2024-01-15T12:30:00.000Z");
      expect(session.endTimestamp).toBe(1705321800000);
      expect(session.duration).toBe(9000000);
    });

    it("should correctly calculate duration from timestamps", () => {
      const startTimestamp = 1705312800000;
      const endTimestamp = 1705316400000; // 1 hour later
      const expectedDuration = endTimestamp - startTimestamp;

      const session: SessionEntry = {
        username: "player",
        startTime: new Date(startTimestamp).toISOString(),
        startTimestamp,
        endTime: new Date(endTimestamp).toISOString(),
        endTimestamp,
        duration: expectedDuration,
      };

      expect(session.duration).toBe(3600000); // 1 hour in ms
    });
  });
});

describe("SessionMetadata", () => {
  describe("interface", () => {
    it("should create metadata with a single session", () => {
      const metadata: SessionMetadata = {
        lastPlayed: "2024-01-15T12:30:00.000Z",
        lastPlayedTimestamp: 1705321800000,
        username: "player1",
        sessions: [
          {
            username: "player1",
            startTime: "2024-01-15T10:00:00.000Z",
            startTimestamp: 1705312800000,
            endTime: "2024-01-15T12:30:00.000Z",
            endTimestamp: 1705321800000,
            duration: 9000000,
          },
        ],
      };

      expect(metadata.lastPlayed).toBe("2024-01-15T12:30:00.000Z");
      expect(metadata.username).toBe("player1");
      expect(metadata.sessions).toHaveLength(1);
    });

    it("should create metadata with multiple sessions from different users", () => {
      const metadata: SessionMetadata = {
        lastPlayed: "2024-01-16T14:00:00.000Z",
        lastPlayedTimestamp: 1705413600000,
        username: "player2",
        sessions: [
          {
            username: "player1",
            startTime: "2024-01-15T10:00:00.000Z",
            startTimestamp: 1705312800000,
            endTime: "2024-01-15T12:30:00.000Z",
            endTimestamp: 1705321800000,
            duration: 9000000,
          },
          {
            username: "player2",
            startTime: "2024-01-16T12:00:00.000Z",
            startTimestamp: 1705406400000,
            endTime: "2024-01-16T14:00:00.000Z",
            endTimestamp: 1705413600000,
            duration: 7200000,
          },
        ],
      };

      expect(metadata.sessions).toHaveLength(2);
      expect(metadata.sessions[0].username).toBe("player1");
      expect(metadata.sessions[1].username).toBe("player2");
    });

    it("should create empty sessions array for new server", () => {
      const metadata: SessionMetadata = {
        lastPlayed: "2024-01-15T10:00:00.000Z",
        lastPlayedTimestamp: 1705312800000,
        username: "newplayer",
        sessions: [],
      };

      expect(metadata.sessions).toHaveLength(0);
    });
  });
});

describe("ServerStatistics", () => {
  describe("interface", () => {
    it("should create statistics with total playtime", () => {
      const stats: ServerStatistics = {
        totalPlaytime: 18000000, // 5 hours
        sessionCount: 3,
        sessions: [
          {
            username: "player1",
            startTime: "2024-01-15T10:00:00.000Z",
            startTimestamp: 1705312800000,
            endTime: "2024-01-15T12:00:00.000Z",
            endTimestamp: 1705320000000,
            duration: 7200000, // 2 hours
          },
          {
            username: "player1",
            startTime: "2024-01-16T10:00:00.000Z",
            startTimestamp: 1705399200000,
            endTime: "2024-01-16T11:00:00.000Z",
            endTimestamp: 1705402800000,
            duration: 3600000, // 1 hour
          },
          {
            username: "player2",
            startTime: "2024-01-17T14:00:00.000Z",
            startTimestamp: 1705500000000,
            endTime: "2024-01-17T16:00:00.000Z",
            endTimestamp: 1705507200000,
            duration: 7200000, // 2 hours
          },
        ],
      };

      expect(stats.totalPlaytime).toBe(18000000);
      expect(stats.sessionCount).toBe(3);
      expect(stats.sessions).toHaveLength(3);
    });

    it("should create empty statistics for unused server", () => {
      const stats: ServerStatistics = {
        totalPlaytime: 0,
        sessionCount: 0,
        sessions: [],
      };

      expect(stats.totalPlaytime).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessions).toHaveLength(0);
    });

    it("should reflect correct session count", () => {
      const stats: ServerStatistics = {
        totalPlaytime: 3600000,
        sessionCount: 1,
        sessions: [
          {
            username: "solo-player",
            startTime: "2024-01-15T10:00:00.000Z",
            startTimestamp: 1705312800000,
            endTime: "2024-01-15T11:00:00.000Z",
            endTimestamp: 1705316400000,
            duration: 3600000,
          },
        ],
      };

      expect(stats.sessionCount).toBe(stats.sessions.length);
    });
  });
});
