import { roomChannel } from "@contexts/p2p-tunnel/infrastructure/Realtime";
import {
  createModsClient,
  MODS_LABEL,
  serveMods,
  type ModsClient,
} from "@contexts/p2p-tunnel/infrastructure/modsChannel";
import {
  answerFrom,
  DIAG_DETAIL_MAX,
  diagFrom,
  offerFor,
  type Diag,
  type DiagCode,
  type Signal,
  type SignalMessage,
} from "@contexts/p2p-tunnel/infrastructure/signaling";

// Signaling over the room's realtime channel (Ably or the RoomHub), then each TCP connection rides its own WebRTC data channel.
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

// A dropped connection (network blip, new public IP) is repaired with an ICE restart, which keeps
// the data channels and so the players' Minecraft sessions. "disconnected" often heals by itself first.
const RECOVER_DELAY_MS = 3_000;
// Minecraft times a player out after 30 s without traffic: past that, a fresh tunnel is as good
const RECOVER_WINDOW_MS = 30_000;
const RESTART_TIMEOUT_MS = 10_000;
const RESTART_RETRY_MS = 2_000;
// The host keeps a dropped peer while the friend may still be restarting it
// (the last attempt starts within RECOVER_WINDOW_MS and takes up to ~25 s)
const HOST_GRACE_MS = 60_000;

const DIAG_THROTTLE_MS = 5_000;
const DIAG_EVENT = "p2p_diag";

/** What the host learns about a friend's tunnel; `from` is the friend's clientId. */
export interface HostEvents {
  onOpened: (from: string) => void;
  /** The connection dropped; it gets HOST_GRACE_MS to recover */
  onInterrupted: (from: string) => void;
  onRecovered: (from: string) => void;
  onClosed: (from: string) => void;
  onDiag: (diag: Diag) => void;
}

interface HostPeer {
  pc: RTCPeerConnection;
  owned: Set<string>;
  from: string;
  connected: boolean;
  /** Pending drop of an interrupted connection */
  grace?: ReturnType<typeof setTimeout>;
  renegotiating?: boolean;
  /** The friend's mod sync channel, at most one */
  mods?: RTCDataChannel;
}

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

/** Goes to the app's log file, for diagnosing dropped tunnels afterwards. */
const trace = (message: string): void => window.p2pAPI.log("info", message);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** How the connection is routed (host = LAN, srflx = through NAT, relay = TURN); never addresses. */
async function routeOf(pc: RTCPeerConnection): Promise<string> {
  try {
    const stats = await pc.getStats();
    let route = "unknown";
    stats.forEach((report) => {
      if (report.type !== "transport" || !report.selectedCandidatePairId) return;
      const pair = stats.get(report.selectedCandidatePairId);
      const local = pair && stats.get(pair.localCandidateId);
      const remote = pair && stats.get(pair.remoteCandidateId);
      if (local && remote)
        route = `${local.candidateType}/${local.protocol} -> ${remote.candidateType}`;
    });
    return route;
  } catch {
    return "unknown";
  }
}

function bridge(
  connId: string,
  dc: RTCDataChannel,
  owned: Set<string>,
  onError?: () => void,
): void {
  dc.binaryType = "arraybuffer";
  dc.bufferedAmountLowThreshold = LOW_WATER_BYTES;
  dataChannels.set(connId, dc);
  owned.add(connId);
  dc.onmessage = (event) =>
    window.p2pAPI.tcpWrite(connId, new Uint8Array(event.data as ArrayBuffer));
  dc.onbufferedamountlow = () => window.p2pAPI.tcpResume(connId);
  dc.onerror = () => onError?.();
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

/** Resolves once connected; rejects on failure or after `timeoutMs`. */
function waitConnected(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.connectionState === "connected") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      pc.removeEventListener("connectionstatechange", check);
      if (error) reject(error);
      else resolve();
    };
    const check = (): void => {
      if (pc.connectionState === "connected") finish();
      else if (pc.connectionState === "failed" || pc.connectionState === "closed")
        finish(new Error("p2p_connection_failed"));
    };
    const timer = setTimeout(() => finish(new Error("p2p_connection_failed")), timeoutMs);
    pc.addEventListener("connectionstatechange", check);
  });
}

// Non-trickle ICE: wait for the end of candidates so a single offer/answer message is enough.
// The null candidate also ends an ICE restart's gathering, which iceGatheringState can't tell apart.
// Called right after setLocalDescription, before any candidate event can be dispatched.
const gatherIce = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      pc.removeEventListener("icecandidate", onCandidate);
      resolve();
    };
    const onCandidate = (event: RTCPeerConnectionIceEvent): void => {
      if (!event.candidate) done();
    };
    // Send whatever candidates we have
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener("icecandidate", onCandidate);
  });

/** Host: answer offers addressed to us on the group's channel and pipe their data channels into the local server. */
export async function startHosting(
  groupId: string,
  serverPort: number,
  serverId: string,
  events: HostEvents,
): Promise<() => void> {
  const channel = await roomChannel(groupId);
  // Keyed by sender + peerId: a member can't take over another member's peer
  const peers = new Map<string, HostPeer>();

  const dropPeer = (key: string, pc: RTCPeerConnection): void => {
    const peer = peers.get(key);
    if (peer?.pc !== pc) return;
    peers.delete(key);
    clearTimeout(peer.grace);
    closePeer(pc, peer.owned);
    if (peer.connected) events.onClosed(peer.from);
  };

  const answer = async (pc: RTCPeerConnection, offer: Signal, to: string): Promise<void> => {
    // Fetched per offer: TURN credentials expire, and hosting can outlive them
    pc.setConfiguration(await window.p2pAPI.getIceServers());
    await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gatherIce(pc);
    await channel.publish("webrtc_answer", {
      peerId: offer.peerId,
      sdp: pc.localDescription!.sdp,
      // Lets the RoomHub deliver it to the friend only; Ably ignores it
      to,
      ...(offer.restart && { restart: offer.restart }),
    });
  };

  const onOffer = async (message: SignalMessage): Promise<void> => {
    const offer = offerFor(message, channel.clientId());
    const from = message.clientId;
    if (!offer || !from) return;
    const key = `${from}:${offer.peerId}`;
    const existing = peers.get(key);

    // ICE restart of a connection we already have: same channels, new network path
    if (offer.restart) {
      if (!existing || existing.renegotiating) return;
      existing.renegotiating = true;
      trace(`host: ICE restart ${offer.restart} requested`);
      try {
        await answer(existing.pc, offer, from);
      } catch (error) {
        console.warn("P2P: failed to answer an ICE restart", error);
        trace(`host: ICE restart ${offer.restart} failed (${(error as Error).message})`);
      } finally {
        existing.renegotiating = false;
      }
      return;
    }

    if (existing) return;
    // A member starting over frees the slots of their connections that dropped
    for (const [k, peer] of peers) {
      const state = peer.pc.connectionState;
      if (peer.from === from && (state === "disconnected" || state === "failed"))
        dropPeer(k, peer.pc);
    }
    const fromCount = [...peers.values()].filter((peer) => peer.from === from).length;
    if (fromCount >= MAX_PEERS_PER_MEMBER) return;
    // ICE servers are set in answer(); creating the connection first reserves the slot
    const pc = new RTCPeerConnection();
    const owned = new Set<string>();
    const peer: HostPeer = { pc, owned, from, connected: false };
    peers.set(key, peer);
    pc.ondatachannel = ({ channel: dc }) => {
      if (dc.label === CONTROL_LABEL) return;
      if (dc.label === MODS_LABEL) {
        // Not a Minecraft connection: doesn't count against the cap, but one per peer
        if (peer.mods?.readyState === "open" || peer.mods?.readyState === "connecting")
          return dc.close();
        peer.mods = dc;
        return serveMods(dc, serverId);
      }
      if (owned.size >= MAX_CONNECTIONS_PER_PEER) return dc.close();
      window.p2pAPI.hostConnect(dc.label, serverPort);
      bridge(dc.label, dc, owned);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      trace(`host: peer connection ${state}`);
      if (state === "connected") {
        void routeOf(pc).then((route) => trace(`host: peer route ${route}`));
        if (!peer.connected) {
          peer.connected = true;
          events.onOpened(from);
        } else if (peer.grace) {
          events.onRecovered(from);
        }
        clearTimeout(peer.grace);
        peer.grace = undefined;
      } else if (state === "closed" || (state === "failed" && !peer.connected)) {
        dropPeer(key, pc);
      } else if ((state === "disconnected" || state === "failed") && peer.connected && !peer.grace) {
        // Keep the channels (and the players' sockets) while the friend restarts ICE
        events.onInterrupted(from);
        peer.grace = setTimeout(() => {
          if (pc.connectionState !== "connected") dropPeer(key, pc);
        }, HOST_GRACE_MS);
      }
    };
    try {
      await answer(pc, offer, from);
      // An offer that never connects would otherwise hold its slot forever
      setTimeout(() => {
        if (pc.connectionState === "new" || pc.connectionState === "connecting") dropPeer(key, pc);
      }, CONNECT_TIMEOUT_MS);
    } catch (error) {
      console.error("P2P: failed to answer offer", error);
      dropPeer(key, pc);
    }
  };
  const onDiag = (message: SignalMessage): void => {
    const diag = diagFrom(message, channel.clientId());
    if (diag) events.onDiag(diag);
  };
  await channel.subscribe("webrtc_offer", onOffer);
  await channel.subscribe(DIAG_EVENT, onDiag);

  // The channel stays attached: presence on it outlives hosting
  return () => {
    channel.unsubscribe("webrtc_offer", onOffer);
    channel.unsubscribe(DIAG_EVENT, onDiag);
    for (const { pc, owned, grace } of peers.values()) {
      clearTimeout(grace);
      closePeer(pc, owned);
    }
    peers.clear();
    window.p2pAPI.closeAll();
    channel.release();
  };
}

export interface JoinedServer {
  port: number;
  /** Mod sync with the host; the channel is created on first use */
  mods: () => ModsClient;
  stop: () => void;
}

/**
 * Friend: offer a connection to the group member `host` (their clientId), then expose it on a local TCP port for Minecraft (the first free of `preferredPorts`, else any).
 * A dropped connection is repaired in place when possible; `onDisconnected` only fires once it can't be.
 */
export async function joinServer(
  groupId: string,
  host: string,
  preferredPorts: number[],
  onDisconnected: () => void,
  onNotice: (code: DiagCode, detail?: string) => void = () => undefined,
): Promise<JoinedServer> {
  const { iceServers } = await window.p2pAPI.getIceServers();
  const channel = await roomChannel(groupId);
  const peerId = crypto.randomUUID();
  const pc = new RTCPeerConnection({ iceServers });
  const owned = new Set<string>();
  // Tell our console and the host (best effort, at most one message per code per few seconds)
  const lastSent = new Map<DiagCode, number>();
  const notice = (code: DiagCode, detail?: string): void => {
    onNotice(code, detail);
    const now = Date.now();
    if (now - (lastSent.get(code) ?? 0) < DIAG_THROTTLE_MS) return;
    lastSent.set(code, now);
    const capped = detail?.slice(0, DIAG_DETAIL_MAX);
    Promise.resolve(channel.publish(DIAG_EVENT, { to: host, code, detail: capped })).catch(
      () => undefined,
    );
  };
  // An offer needs at least one data channel to carry an application section
  pc.createDataChannel(CONTROL_LABEL);

  /** One offer/answer round over the room's channel: the first one (restart 0) or an ICE restart. */
  const negotiate = async (restart: number, timeoutMs: number): Promise<void> => {
    await pc.setLocalDescription(await pc.createOffer({ iceRestart: restart > 0 }));
    await gatherIce(pc);

    let onAnswer: (sdp: string) => void = () => undefined;
    const answer = new Promise<string>((resolve) => (onAnswer = resolve));
    const listener = (message: SignalMessage): void => {
      const sdp = answerFrom(message, host, peerId, restart);
      if (sdp !== null) onAnswer(sdp);
    };
    await channel.subscribe("webrtc_answer", listener);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await channel.publish("webrtc_offer", {
        peerId,
        sdp: pc.localDescription!.sdp,
        to: host,
        ...(restart > 0 && { restart }),
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("p2p_host_not_found")), timeoutMs);
      });
      // Signaling is done once answered; the channel stays attached for presence
      const sdp = await Promise.race([answer, timeout]);
      await pc.setRemoteDescription({ type: "answer", sdp });
    } finally {
      clearTimeout(timer);
      channel.unsubscribe("webrtc_answer", listener);
    }
  };

  try {
    await negotiate(0, ANSWER_TIMEOUT_MS);
    await waitConnected(pc, CONNECT_TIMEOUT_MS);
  } catch (error) {
    pc.close();
    notice("tunnel_failed", error instanceof Error ? error.message : String(error));
    channel.release();
    throw error;
  }

  let port: number;
  try {
    port = await window.p2pAPI.clientListen(preferredPorts);
  } catch (error) {
    pc.close();
    notice("tunnel_failed", error instanceof Error ? error.message : String(error));
    channel.release();
    throw error;
  }
  notice("joined", String(port));
  if (port !== preferredPorts[0]) notice("port_changed", String(port));
  void routeOf(pc).then((route) => trace(`friend: route ${route}`));
  const offOpen = window.p2pAPI.onTcpOpen((connId) =>
    bridge(connId, pc.createDataChannel(connId), owned, () =>
      notice("channel_failed", "data channel error"),
    ),
  );
  let modsClient: ModsClient | null = null;
  const mods = (): ModsClient => (modsClient ??= createModsClient(pc));
  let stopped = false;
  const stop = (): void => {
    stopped = true;
    offOpen();
    pc.onconnectionstatechange = null;
    closePeer(pc, owned);
    window.p2pAPI.closeAll();
    channel.release();
  };
  const giveUp = (): void => {
    if (stopped) return;
    // Before stop() releases the channel it goes out on
    notice("tunnel_closed", String(port));
    stop();
    onDisconnected();
  };

  let recovering = false;
  let restarts = 0;
  const recover = async (): Promise<void> => {
    if (recovering || stopped) return;
    recovering = true;
    notice("reconnecting");
    const deadline = Date.now() + RECOVER_WINDOW_MS;
    await sleep(RECOVER_DELAY_MS);
    while (!stopped && pc.connectionState !== "connected" && Date.now() < deadline) {
      restarts += 1;
      trace(`friend: ICE restart ${restarts}`);
      try {
        await negotiate(restarts, RESTART_TIMEOUT_MS);
        await waitConnected(pc, RESTART_TIMEOUT_MS);
      } catch (error) {
        trace(`friend: ICE restart ${restarts} failed (${(error as Error).message})`);
        // Signaling may be down too: don't spin while it comes back
        await sleep(RESTART_RETRY_MS);
      }
    }
    recovering = false;
    if (stopped) return;
    if (pc.connectionState === "connected") {
      notice("recovered");
      void routeOf(pc).then((route) => trace(`friend: route ${route}`));
    } else giveUp();
  };
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    trace(`friend: connection ${state}`);
    if (state === "closed") giveUp();
    else if (state === "disconnected" || state === "failed") void recover();
  };
  return { port, mods, stop };
}
