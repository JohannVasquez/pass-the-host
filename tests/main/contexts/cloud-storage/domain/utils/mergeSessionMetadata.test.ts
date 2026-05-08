import { describe, expect, it } from "vitest";
import type { SessionMetadata } from "@main/contexts/cloud-storage/domain/entities";
import { mergeSessionMetadata } from "@main/contexts/cloud-storage/domain/utils/mergeSessionMetadata";

describe("mergeSessionMetadata", () => {
  it("returns null when both metadata sources are missing", () => {
    expect(mergeSessionMetadata(null, null)).toBeNull();
  });

  it("merges distinct local and remote sessions", () => {
    const remoteSession: SessionMetadata = {
      lastPlayed: "2024-01-10T11:00:00.000Z",
      lastPlayedTimestamp: 1704884400000,
      username: "alice",
      sessions: [
        {
          username: "alice",
          startTime: "2024-01-10T10:00:00.000Z",
          startTimestamp: 1704880800000,
          endTime: "2024-01-10T11:00:00.000Z",
          endTimestamp: 1704884400000,
          duration: 3600000,
        },
      ],
    };

    const localSession: SessionMetadata = {
      lastPlayed: "2024-01-11T13:00:00.000Z",
      lastPlayedTimestamp: 1704978000000,
      username: "bob",
      sessions: [
        {
          username: "bob",
          startTime: "2024-01-11T12:00:00.000Z",
          startTimestamp: 1704974400000,
          endTime: "2024-01-11T13:00:00.000Z",
          endTimestamp: 1704978000000,
          duration: 3600000,
        },
      ],
    };

    const mergedSession = mergeSessionMetadata(localSession, remoteSession);

    expect(mergedSession).toEqual({
      lastPlayed: "2024-01-11T13:00:00.000Z",
      lastPlayedTimestamp: 1704978000000,
      username: "bob",
      sessions: [...remoteSession.sessions, ...localSession.sessions],
    });
  });

  it("deduplicates matching sessions by username and startTimestamp", () => {
    const remoteSession: SessionMetadata = {
      lastPlayed: "2024-01-10T10:00:00.000Z",
      lastPlayedTimestamp: 1704880800000,
      username: "alice",
      sessions: [
        {
          username: "alice",
          startTime: "2024-01-10T10:00:00.000Z",
          startTimestamp: 1704880800000,
        },
      ],
    };

    const localSession: SessionMetadata = {
      lastPlayed: "2024-01-10T11:00:00.000Z",
      lastPlayedTimestamp: 1704884400000,
      username: "alice",
      sessions: [
        {
          username: "alice",
          startTime: "2024-01-10T10:00:00.000Z",
          startTimestamp: 1704880800000,
          endTime: "2024-01-10T11:00:00.000Z",
          endTimestamp: 1704884400000,
          duration: 3600000,
        },
      ],
    };

    const mergedSession = mergeSessionMetadata(localSession, remoteSession);

    expect(mergedSession?.sessions).toHaveLength(1);
    expect(mergedSession?.sessions[0]).toEqual(localSession.sessions[0]);
    expect(mergedSession?.lastPlayedTimestamp).toBe(1704884400000);
  });

  it("keeps the most complete session when duplicates conflict", () => {
    const remoteSession: SessionMetadata = {
      lastPlayed: "2024-01-12T15:00:00.000Z",
      lastPlayedTimestamp: 1705071600000,
      username: "carol",
      sessions: [
        {
          username: "carol",
          startTime: "2024-01-12T14:00:00.000Z",
          startTimestamp: 1705068000000,
          endTime: "2024-01-12T15:00:00.000Z",
          endTimestamp: 1705071600000,
          duration: 3600000,
        },
      ],
    };

    const localSession: SessionMetadata = {
      lastPlayed: "2024-01-12T14:00:00.000Z",
      lastPlayedTimestamp: 1705068000000,
      username: "carol",
      sessions: [
        {
          username: "carol",
          startTime: "2024-01-12T14:00:00.000Z",
          startTimestamp: 1705068000000,
        },
      ],
    };

    const mergedSession = mergeSessionMetadata(localSession, remoteSession);

    expect(mergedSession?.sessions).toEqual(remoteSession.sessions);
    expect(mergedSession?.lastPlayed).toBe(remoteSession.lastPlayed);
  });
});
