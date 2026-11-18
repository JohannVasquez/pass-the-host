import type { PresenceMember, RoomChannel } from "@contexts/p2p-tunnel/infrastructure/Realtime";
import type { SignalMessage } from "@contexts/p2p-tunnel/infrastructure/signaling";

// Answered by the Worker runtime without waking the room, so pings are free
const PING_MS = 5_000;
// No frame (not even a pong) for this long: the socket is dead even if it doesn't know yet
const DEAD_MS = 15_000;
const PUBLISH_WAIT_MS = 10_000;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000];
/** The API closed us because we're no longer a member: reconnecting can't work. */
const KICKED = 4403;

type Listener = (message: SignalMessage) => void;

/** A room channel over one socket to the Worker's RoomHub. Reconnects and re-enters presence by itself, like Ably. */
export function openRoomSocket(groupId: string): RoomChannel {
  let ws: WebSocket | null = null;
  let live = false;
  let clientId = "";
  let members: PresenceMember[] = [];
  let snapshot = false;
  // Our presence, sent again after a reconnect; the same connKey replaces our lingering entry
  let presence: unknown;
  const connKey = crypto.randomUUID();
  const listeners = new Map<string, Set<Listener>>();
  const presenceListeners = new Set<() => void>();
  let waiters: Array<(ok: boolean) => void> = [];
  let released = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (frame: unknown): void => ws?.send(JSON.stringify(frame));
  const notifyPresence = (): void => presenceListeners.forEach((listener) => listener());
  const flushWaiters = (ok: boolean): void => {
    waiters.forEach((resolve) => resolve(ok));
    waiters = [];
  };
  const waitOpen = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => done(false), PUBLISH_WAIT_MS);
      const done = (ok: boolean): void => {
        clearTimeout(timer);
        if (ok) resolve();
        else reject(new Error("realtime_unavailable"));
      };
      waiters.push(done);
    });

  /** Not a member anymore (or the room is gone): stop for good and show nobody. */
  const fail = (): void => {
    released = true;
    flushWaiters(false);
    members = [];
    notifyPresence();
  };
  const retry = (): void => {
    if (released) return;
    retryTimer = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
  };

  async function connect(): Promise<void> {
    let url: string;
    try {
      url = await window.p2pAPI.getRoomUrl(groupId);
    } catch (error) {
      return (error as Error).message.includes("group_not_found") ? fail() : retry();
    }
    if (released) return;
    const socket = new WebSocket(url);
    ws = socket;
    let lastSeen = Date.now();

    const down = (code: number): void => {
      clearInterval(ping);
      if (ws !== socket) return;
      ws = null;
      live = false;
      if (code === KICKED) fail();
      else retry();
    };
    const ping = setInterval(() => {
      if (Date.now() - lastSeen <= DEAD_MS) return socket.send("ping");
      // A dead network may never deliver the close: move on without waiting for it
      socket.onclose = null;
      socket.close();
      down(4000);
    }, PING_MS);

    socket.onmessage = (event) => {
      lastSeen = Date.now();
      if (event.data === "pong") return;
      let frame: { t?: string; clientId?: string; members?: PresenceMember[]; name?: string; data?: unknown };
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (frame.t === "hello" && frame.clientId) {
        clientId = frame.clientId;
        live = true;
        attempt = 0;
        if (presence !== undefined) send({ t: "presence", connKey, data: presence });
        flushWaiters(true);
      } else if (frame.t === "presence" && Array.isArray(frame.members)) {
        members = frame.members;
        snapshot = true;
        notifyPresence();
      } else if (frame.t === "msg" && frame.name) {
        const message = { clientId: frame.clientId, data: frame.data };
        listeners.get(frame.name)?.forEach((listener) => listener(message));
      }
    };
    socket.onclose = (event) => down(event.code);
  }

  void connect();

  return {
    clientId: () => clientId,
    // Sent right away when connected, so a publish just before release still goes out
    publish: async (name, data) => {
      if (!live) await waitOpen();
      send({ t: "pub", name, data });
    },
    subscribe: async (name, listener) => {
      const set = listeners.get(name) ?? new Set();
      listeners.set(name, set.add(listener));
    },
    unsubscribe: (name, listener) => void listeners.get(name)?.delete(listener),
    presence: {
      get: async () => members,
      subscribe: async (listener) => {
        presenceListeners.add(listener);
        // The room's snapshot may have arrived first
        if (snapshot) listener();
      },
      unsubscribe: (listener) => void presenceListeners.delete(listener),
      update: async (data) => {
        presence = data;
        if (live) send({ t: "presence", connKey, data });
      },
      leave: async () => {
        presence = undefined;
        if (live) send({ t: "leave" });
      },
    },
    release: () => {
      released = true;
      clearTimeout(retryTimer);
      listeners.clear();
      presenceListeners.clear();
      flushWaiters(false);
      const socket = ws;
      ws = null;
      live = false;
      // 1000 = leaving on purpose: the room drops our presence at once instead of letting it linger
      socket?.close(1000);
    },
  };
}
