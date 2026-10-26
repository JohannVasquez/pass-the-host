import { channelName, getRealtime } from "@contexts/p2p-tunnel/infrastructure/Realtime";

export interface PresenceState {
  name: string;
  hosting: boolean;
  /** Set while hosting: which Minecraft server and since when (epoch ms) */
  serverName?: string;
  hostingSince?: number;
}

export interface OnlineMember extends PresenceState {
  clientId: string;
  isYou: boolean;
}

export interface NetworkPresence {
  /** Enters the first time, then updates our own name/hosting flag. */
  set: (state: PresenceState) => void;
  leave: () => void;
}

/** Announces this app on the network's channel and reports everyone online (one entry per user). */
export function watchPresence(
  groupId: string,
  onChange: (online: OnlineMember[]) => void,
  onError: (error: unknown) => void,
): NetworkPresence {
  const realtime = getRealtime();
  const channel = realtime.channels.get(channelName(groupId));
  const presence = channel.presence;
  let left = false;

  const sync = async (): Promise<void> => {
    const members = await presence.get();
    if (left) return;
    // The same user may have the app open twice: merge their connections
    const byUser = new Map<string, OnlineMember>();
    for (const member of members) {
      const state = member.data as PresenceState;
      const previous = byUser.get(member.clientId);
      // Keep the hosting connection's details when the user has several
      byUser.set(member.clientId, {
        ...(previous?.hosting ? previous : state),
        clientId: member.clientId,
        name: state.name,
        hosting: state.hosting || (previous?.hosting ?? false),
        isYou: member.clientId === realtime.auth.clientId,
      });
    }
    onChange([...byUser.values()]);
  };

  const listener = (): void => void sync().catch(onError);
  presence.subscribe(listener).catch(onError);

  return {
    set: (state) => presence.update(state).then(sync).catch(onError),
    leave: () => {
      left = true;
      presence.unsubscribe(listener);
      // Leaving the network view is the last use of its channel (hosting stops with it)
      presence
        .leave()
        .then(() => channel.detach())
        .catch(() => undefined);
    },
  };
}
