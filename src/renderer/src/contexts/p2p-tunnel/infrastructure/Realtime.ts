import * as Ably from "ably";
import { openRoomSocket } from "@contexts/p2p-tunnel/infrastructure/RoomSocket";
import type { SignalMessage } from "@contexts/p2p-tunnel/infrastructure/signaling";

export interface PresenceMember {
  clientId: string;
  data: unknown;
}

/** A room's realtime channel: on Ably, or on the Worker's RoomHub Durable Object (the API's `/config` picks). */
export interface RoomChannel {
  /** Our verified user id, once connected */
  clientId: () => string;
  publish: (name: string, data: unknown) => Promise<void>;
  subscribe: (name: string, listener: (message: SignalMessage) => void) => Promise<void>;
  unsubscribe: (name: string, listener: (message: SignalMessage) => void) => void;
  presence: {
    get: () => Promise<PresenceMember[]>;
    subscribe: (listener: () => void) => Promise<void>;
    unsubscribe: (listener: () => void) => void;
    update: (data: unknown) => Promise<void>;
    leave: () => Promise<void>;
  };
  /** Done with the channel. */
  release: () => void;
}

// One Ably connection per app, shared by presence and tunnel signaling (one channel per network)
export const channelName = (groupId: string): string => `server:${groupId}`;

let realtime: Ably.Realtime | null = null;

export function getRealtime(): Ably.Realtime {
  realtime ??= new Ably.Realtime({
    authCallback: (_params, callback) => {
      window.p2pAPI.getAblyToken().then(
        (tokenRequest) => callback(null, tokenRequest),
        (error: Error) => callback(error.message, null),
      );
    },
  });
  return realtime;
}

let mode: Promise<"ably" | "do"> | null = null;
// ponytail: Ably stays the fallback while both backends exist; drop it (and this flag) once rooms run on "do"
const realtimeMode = (): Promise<"ably" | "do"> =>
  (mode ??= window.p2pAPI.getRealtimeMode().catch(() => "ably" as const));

/** Token capabilities are fixed per network membership: reconnect after joining, creating or deleting one. */
export function resetRealtime(): void {
  realtime?.close();
  realtime = null;
  // Picks up a backend switch on the next room action
  mode = null;
}

function ablyChannel(groupId: string, detachOnRelease: boolean): RoomChannel {
  const ably = getRealtime();
  const channel = ably.channels.get(channelName(groupId));
  return {
    clientId: () => ably.auth.clientId,
    publish: async (name, data) => void (await channel.publish(name, data)),
    subscribe: async (name, listener) => void (await channel.subscribe(name, listener)),
    unsubscribe: (name, listener) => channel.unsubscribe(name, listener),
    presence: {
      get: () => channel.presence.get(),
      subscribe: async (listener) => void (await channel.presence.subscribe(listener)),
      unsubscribe: (listener) => channel.presence.unsubscribe(listener),
      update: (data) => channel.presence.update(data),
      leave: () => channel.presence.leave(),
    },
    // The Ably channel is shared: only its presence user (the network view) detaches it
    release: () => {
      if (detachOnRelease) channel.detach().catch(() => undefined);
    },
  };
}

/**
 * The room's channel. On the RoomHub each call opens its own socket, closed by `release`;
 * on Ably all calls share the room's channel and `detachOnRelease` marks its last user.
 */
export async function roomChannel(
  groupId: string,
  { detachOnRelease = false } = {},
): Promise<RoomChannel> {
  return (await realtimeMode()) === "do"
    ? openRoomSocket(groupId)
    : ablyChannel(groupId, detachOnRelease);
}
