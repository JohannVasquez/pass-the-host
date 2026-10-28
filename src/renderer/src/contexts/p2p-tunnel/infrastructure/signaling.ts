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

/** Friend -> host diagnostics. No SDP, ICE or IPs ever go in one. */
export const DIAG_CODES = [
  "joined",
  "port_changed",
  "tunnel_failed",
  "tunnel_closed",
  "channel_failed",
] as const;
export type DiagCode = (typeof DIAG_CODES)[number];
export const DIAG_DETAIL_MAX = 200;

export interface Diag {
  from: string;
  code: DiagCode;
  detail?: string;
}

/** A diagnostic addressed to this host (`self` = our clientId) with a known code, or null. */
export function diagFrom(message: SignalMessage, self: string): Diag | null {
  const data = message.data as { to?: unknown; code?: unknown; detail?: unknown } | null;
  if (typeof message.clientId !== "string" || data === null || typeof data !== "object")
    return null;
  if (data.to !== self || !DIAG_CODES.includes(data.code as DiagCode)) return null;
  const detail =
    typeof data.detail === "string" ? data.detail.slice(0, DIAG_DETAIL_MAX) : undefined;
  return { from: message.clientId, code: data.code as DiagCode, detail };
}
