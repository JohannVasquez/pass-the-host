import type { ClientModManifest } from "@preload/index.d";

// Mod sync rides a "mods" data channel on the friend's existing peer connection:
// one JSON request at a time, answered with JSON (+ binary slices for a file).

export const MODS_LABEL = "mods";
const CHUNK_BYTES = 64 * 1024;
const HIGH_WATER_BYTES = 1024 * 1024;
const LOW_WATER_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;
const SHA1 = /^[0-9a-f]{40}$/;
const WATCH_INTERVAL_MS = 5_000;

// Host

const reply = (dc: RTCDataChannel, message: object): void => dc.send(JSON.stringify(message));

async function drain(dc: RTCDataChannel): Promise<void> {
  while (dc.readyState === "open" && dc.bufferedAmount > HIGH_WATER_BYTES) {
    await new Promise<void>((resolve) => {
      const done = (): void => {
        dc.removeEventListener("bufferedamountlow", done);
        dc.removeEventListener("close", done);
        resolve();
      };
      dc.addEventListener("bufferedamountlow", done);
      dc.addEventListener("close", done);
    });
  }
}

/** Host: answer a friend's manifest/file requests for `serverId` on one "mods" channel. */
export function serveMods(dc: RTCDataChannel, serverId: string): void {
  dc.binaryType = "arraybuffer";
  dc.bufferedAmountLowThreshold = LOW_WATER_BYTES;
  // The protocol is one request at a time: a chained queue keeps answers in order
  let queue: Promise<void> = Promise.resolve();
  const handle = async (raw: unknown): Promise<void> => {
    try {
      let request: { op?: unknown; sha1?: unknown };
      try {
        request = JSON.parse(String(raw)) as typeof request;
      } catch {
        return reply(dc, { op: "error", message: "bad_request" });
      }
      if (request.op === "manifest") {
        const manifest = await window.modsAPI.clientManifest(serverId);
        return reply(dc, { op: "manifest", manifest });
      }
      if (request.op === "file" && typeof request.sha1 === "string" && SHA1.test(request.sha1)) {
        const data = await window.modsAPI.readClientMod(serverId, request.sha1);
        reply(dc, { op: "file", sha1: request.sha1, size: data.byteLength });
        for (let i = 0; i < data.byteLength && dc.readyState === "open"; i += CHUNK_BYTES) {
          dc.send(new Uint8Array(data.subarray(i, i + CHUNK_BYTES)));
          await drain(dc);
        }
        return;
      }
      reply(dc, { op: "error", message: "bad_request" });
    } catch {
      if (dc.readyState === "open") reply(dc, { op: "error", message: "unavailable" });
    }
  };
  dc.onmessage = (event) => {
    if (typeof event.data !== "string") return;
    queue = queue.then(() => handle(event.data));
  };

  // Tell the friend when the mod folders change: a stat-only fingerprint compared every few seconds
  let last: string | null = null;
  // ponytail: 5 s stat poll, fs.watch if it ever matters
  const timer = setInterval(() => {
    queue = queue.then(async () => {
      if (dc.readyState !== "open") return;
      try {
        const now = await window.modsAPI.modsFingerprint(serverId);
        if (last !== null && now !== last) reply(dc, { op: "changed" });
        last = now;
      } catch {
        // Server gone or unreadable: try again next tick
      }
    });
  }, WATCH_INTERVAL_MS);
  dc.addEventListener("close", () => clearInterval(timer));
  void window.modsAPI.modsFingerprint(serverId).then(
    (now) => {
      last ??= now;
    },
    () => undefined,
  );
}

// Friend

export interface ModsClient {
  manifest(): Promise<ClientModManifest>;
  /** Fetches the jar with this sha1; `size` is what the manifest announced. */
  file(sha1: string, size: number): Promise<Uint8Array>;
  /** The host's mod folders changed (pushed unprompted); returns the unsubscribe */
  onChanged(listener: () => void): () => void;
  close(): void;
}

export function createModsClient(pc: RTCPeerConnection): ModsClient {
  const dc = pc.createDataChannel(MODS_LABEL);
  dc.binaryType = "arraybuffer";
  const opened = new Promise<void>((resolve, reject) => {
    dc.addEventListener("open", () => resolve(), { once: true });
    dc.addEventListener("close", () => reject(new Error("mods_channel_closed")), { once: true });
  });
  opened.catch(() => undefined);

  // Set by the request in flight
  let onText: ((text: string) => void) | null = null;
  let onBinary: ((data: ArrayBuffer) => void) | null = null;
  let onClose: (() => void) | null = null;
  const changed = new Set<() => void>();
  dc.onmessage = (event) => {
    if (typeof event.data !== "string") return onBinary?.(event.data as ArrayBuffer);
    try {
      if ((JSON.parse(event.data) as { op?: unknown }).op === "changed") {
        changed.forEach((listener) => listener());
        return;
      }
    } catch {
      // Not JSON: the request in flight reports it
    }
    onText?.(event.data);
  };
  dc.addEventListener("close", () => onClose?.());

  // `step` is fed every message and calls `finish` when the answer is complete
  const request = <T>(
    message: object,
    step: (
      text: string | null,
      data: ArrayBuffer | null,
      finish: (value: T) => void,
      fail: (error: Error) => void,
    ) => void,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const clear = (): void => {
        clearTimeout(timer);
        onText = onBinary = onClose = null;
      };
      const finish = (value: T): void => {
        clear();
        resolve(value);
      };
      const fail = (error: Error): void => {
        clear();
        reject(error);
      };
      const arm = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => fail(new Error("mods_timeout")), REQUEST_TIMEOUT_MS);
      };
      onText = (text) => {
        arm();
        step(text, null, finish, fail);
      };
      onBinary = (data) => {
        arm();
        step(null, data, finish, fail);
      };
      onClose = () => fail(new Error("mods_channel_closed"));
      arm();
      opened.then(
        () => {
          if (dc.readyState === "open") dc.send(JSON.stringify(message));
        },
        () => fail(new Error("mods_channel_closed")),
      );
    });

  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };

  return {
    manifest: () =>
      enqueue(() =>
        request<ClientModManifest>({ op: "manifest" }, (text, _data, finish, fail) => {
          if (text === null) return;
          try {
            const answer = JSON.parse(text) as { op?: string; manifest?: ClientModManifest };
            if (answer.op === "manifest" && answer.manifest) finish(answer.manifest);
            else fail(new Error("mods_host_error"));
          } catch {
            fail(new Error("mods_host_error"));
          }
        }),
      ),
    file: (sha1, size) =>
      enqueue(() => {
        let expected = -1;
        let received = 0;
        const parts: Uint8Array[] = [];
        return request<Uint8Array>({ op: "file", sha1 }, (text, data, finish, fail) => {
          if (text !== null) {
            try {
              const head = JSON.parse(text) as { op?: string; sha1?: string; size?: number };
              if (head.op !== "file" || head.sha1 !== sha1 || head.size !== size)
                return fail(new Error("mods_host_error"));
              expected = head.size;
            } catch {
              return fail(new Error("mods_host_error"));
            }
          } else if (data && expected >= 0) {
            received += data.byteLength;
            if (received > expected) return fail(new Error("mods_size_mismatch"));
            parts.push(new Uint8Array(data));
          } else return fail(new Error("mods_host_error"));
          if (expected >= 0 && received === expected) {
            const out = new Uint8Array(expected);
            let at = 0;
            for (const part of parts) {
              out.set(part, at);
              at += part.byteLength;
            }
            finish(out);
          }
        });
      }),
    onChanged: (listener) => {
      changed.add(listener);
      return () => changed.delete(listener);
    },
    close: () => dc.close(),
  };
}
