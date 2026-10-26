import { channelName, getRealtime } from "@contexts/p2p-tunnel/infrastructure/Realtime";
import {
  answerFrom,
  offerFor,
  type SignalMessage,
} from "@contexts/p2p-tunnel/infrastructure/signaling";

// Signaling over Ably (one channel per group), then each TCP connection rides its own WebRTC data channel.
// The TCP sockets live in the main process; bytes cross over IPC keyed by connId (= data channel label).

// 16 KiB messages cap SCTP at ~0.6 MB/s here; 64 KiB measured ~75 MB/s and stays under the 256 KiB limit
const CHUNK_BYTES = 64 * 1024;
const HIGH_WATER_BYTES = 1024 * 1024;
const LOW_WATER_BYTES = 256 * 1024;
const ICE_GATHER_TIMEOUT_MS = 5_000;
const ANSWER_TIMEOUT_MS = 20_000;
const CONNECT_TIMEOUT_MS = 20_000;
const CONTROL_LABEL = "control";
// Any room member can send offers: cap what one member can open on the host
const MAX_PEERS_PER_MEMBER = 2;
const MAX_CONNECTIONS_PER_PEER = 16;

const dataChannels = new Map<string, RTCDataChannel>();

window.p2pAPI.onTcpData((connId, data) => {
  const dc = dataChannels.get(connId);
  if (dc?.readyState !== "open") return;
  for (let i = 0; i < data.byteLength; i += CHUNK_BYTES) dc.send(data.subarray(i, i + CHUNK_BYTES));
  if (dc.bufferedAmount > HIGH_WATER_BYTES) window.p2pAPI.tcpPause(connId);
});

window.p2pAPI.onTcpClose((connId) => {
  dataChannels.get(connId)?.close();
  dataChannels.delete(connId);
});

function bridge(connId: string, dc: RTCDataChannel, owned: Set<string>): void {
  dc.binaryType = "arraybuffer";
  dc.bufferedAmountLowThreshold = LOW_WATER_BYTES;
  dataChannels.set(connId, dc);
  owned.add(connId);
  dc.onmessage = (event) =>
    window.p2pAPI.tcpWrite(connId, new Uint8Array(event.data as ArrayBuffer));
  dc.onbufferedamountlow = () => window.p2pAPI.tcpResume(connId);
  dc.onclose = () => {
    dataChannels.delete(connId);
    owned.delete(connId);
    window.p2pAPI.tcpEnd(connId);
  };
  // The socket starts paused in main so nothing is lost before the channel opens
  const start = (): void => window.p2pAPI.tcpResume(connId);
  if (dc.readyState === "open") start();
  else dc.addEventListener("open", start, { once: true });
}

/** Closing a peer connection doesn't fire `close` on its channels, so end their sockets explicitly. */
function closePeer(pc: RTCPeerConnection, owned: Set<string>): void {
  pc.close();
  for (const connId of owned) {
    dataChannels.delete(connId);
    window.p2pAPI.tcpEnd(connId);
  }
  owned.clear();
}

function waitFor(
  pc: RTCPeerConnection,
  event: "icegatheringstatechange" | "connectionstatechange",
  done: () => boolean,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<void> {
  if (done()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      pc.removeEventListener(event, check);
      if (error) reject(error);
      else resolve();
    };
    const check = (): void => {
      if (pc.connectionState === "failed") finish(new Error("p2p_connection_failed"));
      else if (done()) finish();
    };
    const timer = setTimeout(() => {
      try {
        onTimeout();
        finish();
      } catch (error) {
        finish(error as Error);
      }
    }, timeoutMs);
    pc.addEventListener(event, check);
  });
}

// Non-trickle ICE: wait for candidates so a single offer/answer message is enough
const gatherIce = (pc: RTCPeerConnection): Promise<void> =>
  waitFor(
    pc,
    "icegatheringstatechange",
    () => pc.iceGatheringState === "complete",
    ICE_GATHER_TIMEOUT_MS,
    () => undefined, // send whatever candidates we have
  );

const isClosed = (pc: RTCPeerConnection): boolean =>
  pc.connectionState === "failed" || pc.connectionState === "closed";

/** Host: answer offers addressed to us on the group's channel and pipe their data channels into the local server. */
export async function startHosting(groupId: string, serverPort: number): Promise<() => void> {
  const realtime = getRealtime();
  const channel = realtime.channels.get(channelName(groupId));
  // Keyed by sender + peerId: a member can't take over another member's peer
  const peers = new Map<string, { pc: RTCPeerConnection; owned: Set<string>; from: string }>();

  const dropPeer = (key: string, pc: RTCPeerConnection): void => {
    const peer = peers.get(key);
    if (peer?.pc !== pc) return;
    peers.delete(key);
    closePeer(pc, peer.owned);
  };

  const onOffer = async (message: SignalMessage): Promise<void> => {
    const offer = offerFor(message, realtime.auth.clientId);
    const from = message.clientId;
    if (!offer || !from) return;
    const key = `${from}:${offer.peerId}`;
    const fromCount = [...peers.values()].filter((peer) => peer.from === from).length;
    if (peers.has(key) || fromCount >= MAX_PEERS_PER_MEMBER) return;
    // ICE servers are set below; creating the connection first reserves the slot
    const pc = new RTCPeerConnection();
    const owned = new Set<string>();
    peers.set(key, { pc, owned, from });
    pc.ondatachannel = ({ channel: dc }) => {
      if (dc.label === CONTROL_LABEL) return;
      if (owned.size >= MAX_CONNECTIONS_PER_PEER) return dc.close();
      window.p2pAPI.hostConnect(dc.label, serverPort);
      bridge(dc.label, dc, owned);
    };
    pc.onconnectionstatechange = () => {
      if (isClosed(pc)) dropPeer(key, pc);
    };
    try {
      // Fetched per offer: TURN credentials expire, and hosting can outlive them
      pc.setConfiguration(await window.p2pAPI.getIceServers());
      await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherIce(pc);
      await channel.publish("webrtc_answer", {
        peerId: offer.peerId,
        sdp: pc.localDescription!.sdp,
      });
      // An offer that never connects would otherwise hold its slot forever
      setTimeout(() => {
        if (pc.connectionState === "new" || pc.connectionState === "connecting") dropPeer(key, pc);
      }, CONNECT_TIMEOUT_MS);
    } catch (error) {
      console.error("P2P: failed to answer offer", error);
      dropPeer(key, pc);
    }
  };
  await channel.subscribe("webrtc_offer", onOffer);

  // The channel stays attached: presence on it outlives hosting
  return () => {
    channel.unsubscribe("webrtc_offer", onOffer);
    for (const { pc, owned } of peers.values()) closePeer(pc, owned);
    peers.clear();
    window.p2pAPI.closeAll();
  };
}

export interface JoinedServer {
  port: number;
  stop: () => void;
}

/** Friend: offer a connection to the group member `host` (their clientId), then expose it on a local TCP port for Minecraft. */
export async function joinServer(
  groupId: string,
  host: string,
  preferredPort: number,
  onDisconnected: () => void,
): Promise<JoinedServer> {
  const { iceServers } = await window.p2pAPI.getIceServers();
  const channel = getRealtime().channels.get(channelName(groupId));
  const peerId = crypto.randomUUID();
  const pc = new RTCPeerConnection({ iceServers });
  const owned = new Set<string>();
  // An offer needs at least one data channel to carry an application section
  pc.createDataChannel(CONTROL_LABEL);

  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);

    let onAnswer: (sdp: string) => void = () => undefined;
    const answer = new Promise<string>((resolve) => (onAnswer = resolve));
    const listener = (message: SignalMessage): void => {
      const sdp = answerFrom(message, host, peerId);
      if (sdp !== null) onAnswer(sdp);
    };
    await channel.subscribe("webrtc_answer", listener);
    await channel.publish("webrtc_offer", { peerId, sdp: pc.localDescription!.sdp, to: host });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("p2p_host_not_found")), ANSWER_TIMEOUT_MS),
    );
    // Signaling is done once answered; the channel stays attached for presence
    const sdp = await Promise.race([answer, timeout]).finally(() =>
      channel.unsubscribe("webrtc_answer", listener),
    );

    await pc.setRemoteDescription({ type: "answer", sdp });
    await waitFor(
      pc,
      "connectionstatechange",
      () => pc.connectionState === "connected",
      CONNECT_TIMEOUT_MS,
      () => {
        throw new Error("p2p_connection_failed");
      },
    );
  } catch (error) {
    pc.close();
    throw error;
  }

  const port = await window.p2pAPI.clientListen(preferredPort);
  const offOpen = window.p2pAPI.onTcpOpen((connId) =>
    bridge(connId, pc.createDataChannel(connId), owned),
  );
  const stop = (): void => {
    offOpen();
    pc.onconnectionstatechange = null;
    closePeer(pc, owned);
    window.p2pAPI.closeAll();
  };
  pc.onconnectionstatechange = () => {
    if (!isClosed(pc)) return;
    stop();
    onDisconnected();
  };
  return { port, stop };
}
