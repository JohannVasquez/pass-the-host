import type { SessionEntry, SessionMetadata } from "@main/contexts/cloud-storage/domain/entities";

function getSessionIdentity(session: SessionEntry): string {
  return `${session.username}:${session.startTimestamp}`;
}

function getSessionCompletenessScore(session: SessionEntry): number {
  let score = 0;

  if (session.endTime) score += 1;
  if (session.endTimestamp !== undefined) score += 1;
  if (session.duration !== undefined) score += 1;

  return score;
}

function pickPreferredSessionEntry(left: SessionEntry, right: SessionEntry): SessionEntry {
  const leftScore = getSessionCompletenessScore(left);
  const rightScore = getSessionCompletenessScore(right);

  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }

  const leftEndTimestamp = left.endTimestamp ?? -1;
  const rightEndTimestamp = right.endTimestamp ?? -1;
  if (leftEndTimestamp !== rightEndTimestamp) {
    return leftEndTimestamp > rightEndTimestamp ? left : right;
  }

  const leftDuration = left.duration ?? -1;
  const rightDuration = right.duration ?? -1;
  return leftDuration >= rightDuration ? left : right;
}

function getSessionActivityTimestamp(session: SessionEntry): number {
  return session.endTimestamp ?? session.startTimestamp;
}

function getSessionActivityIso(session: SessionEntry): string {
  return session.endTime ?? session.startTime;
}

export function mergeSessionMetadata(
  localSession: SessionMetadata | null,
  remoteSession: SessionMetadata | null,
): SessionMetadata | null {
  if (!localSession && !remoteSession) {
    return null;
  }

  const mergedSessions = new Map<string, SessionEntry>();

  for (const session of [...(remoteSession?.sessions ?? []), ...(localSession?.sessions ?? [])]) {
    const identity = getSessionIdentity(session);
    const existing = mergedSessions.get(identity);

    mergedSessions.set(identity, existing ? pickPreferredSessionEntry(existing, session) : session);
  }

  const sessions = [...mergedSessions.values()].sort(
    (left, right) => left.startTimestamp - right.startTimestamp,
  );

  if (sessions.length === 0) {
    return localSession ?? remoteSession;
  }

  const latestSession = sessions.reduce((latest, current) => {
    return getSessionActivityTimestamp(current) > getSessionActivityTimestamp(latest)
      ? current
      : latest;
  });

  return {
    lastPlayed: getSessionActivityIso(latestSession),
    lastPlayedTimestamp: getSessionActivityTimestamp(latestSession),
    username: latestSession.username,
    sessions,
  };
}
