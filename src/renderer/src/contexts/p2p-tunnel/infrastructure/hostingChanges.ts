import type { OnlineMember } from "@contexts/p2p-tunnel/infrastructure/NetworkPresence";

export interface HostingChange {
  type: "started" | "stopped";
  member: OnlineMember;
}

/**
 * Who started or stopped hosting between two presence snapshots. `prev = null` is the first
 * snapshot for a network: servers already running then aren't news, so nothing is reported.
 * Hosts that drop out of presence entirely (app closed, connection lost) count as stopped.
 */
export function hostingChanges(prev: OnlineMember[] | null, next: OnlineMember[]): HostingChange[] {
  if (!prev) return [];
  const before = new Map(prev.map((member) => [member.clientId, member]));
  const after = new Map(next.map((member) => [member.clientId, member]));
  const changes: HostingChange[] = [];
  for (const member of next) {
    if (member.hosting && !member.isYou && !before.get(member.clientId)?.hosting) {
      changes.push({ type: "started", member });
    }
  }
  for (const member of prev) {
    if (member.hosting && !member.isYou && !after.get(member.clientId)?.hosting) {
      changes.push({ type: "stopped", member });
    }
  }
  return changes;
}
