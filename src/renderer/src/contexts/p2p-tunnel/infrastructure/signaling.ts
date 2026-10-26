// Every room member can read and publish on the room's channel, so signals are only trusted
// for what Ably guarantees: `clientId` is the sender's verified user id.

export interface SignalMessage {
  clientId?: string;
  data?: unknown;
}

export interface Signal {
  peerId: string;
  sdp: string;
  /** clientId of the host an offer is meant for */
  to?: string;
}

const isSignal = (data: unknown): data is Signal =>
  typeof (data as Signal | null)?.peerId === "string" && typeof (data as Signal).sdp === "string";

/** An offer addressed to this host (`self` = our clientId), or null. Older apps send no `to`. */
export const offerFor = (message: SignalMessage, self: string): Signal | null =>
  isSignal(message.data) && (message.data.to ?? self) === self ? message.data : null;

/** The answer SDP to our offer, only when the host we offered to sent it: the peerId alone is public. */
export const answerFrom = (message: SignalMessage, host: string, peerId: string): string | null =>
  message.clientId === host && isSignal(message.data) && message.data.peerId === peerId
    ? message.data.sdp
    : null;
