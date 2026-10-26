import * as Ably from "ably";

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

/** Token capabilities are fixed per network membership: reconnect after joining, creating or deleting one. */
export function resetRealtime(): void {
  realtime?.close();
  realtime = null;
}
