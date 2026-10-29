import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer, connect, Server, Socket, AddressInfo } from "net";
import { once } from "events";
import type { WebContents } from "electron";

vi.mock("@shared/infrastructure/logger", () => ({ logger: { warn: vi.fn() } }));

import * as tunnel from "@main/contexts/p2p-tunnel/infrastructure/TcpTunnel";

type Event = [channel: string, connId: string, data?: Uint8Array];

function fakeSender(): {
  sender: WebContents;
  events: Event[];
  next: (channel: string) => Promise<Event>;
} {
  const events: Event[] = [];
  const waiters: Array<{ channel: string; resolve: (e: Event) => void }> = [];
  const sender = {
    isDestroyed: () => false,
    send: (...event: Event) => {
      events.push(event);
      const i = waiters.findIndex((w) => w.channel === event[0]);
      if (i >= 0) waiters.splice(i, 1)[0].resolve(event);
    },
  } as unknown as WebContents;
  const next = (channel: string): Promise<Event> =>
    new Promise((resolve) => waiters.push({ channel, resolve }));
  return { sender, events, next };
}

const listenOnRandomPort = async (server: Server): Promise<number> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as AddressInfo).port;
};

const servers: Server[] = [];
afterEach(() => {
  tunnel.closeAll();
  servers.splice(0).forEach((s) => s.close());
});

describe("TcpTunnel", () => {
  it("falls back to a free port when the preferred one is taken", async () => {
    const blocker = createServer();
    servers.push(blocker);
    const busyPort = await listenOnRandomPort(blocker);
    const { sender } = fakeSender();

    const port = await tunnel.listen(sender, busyPort);

    expect(port).not.toBe(busyPort);
    expect(port).toBeGreaterThan(0);
  });

  it("reuses the saved fallback port before picking a random one", async () => {
    const blocker = createServer();
    servers.push(blocker);
    const busyPort = await listenOnRandomPort(blocker);
    const probe = createServer();
    const savedPort = await listenOnRandomPort(probe);
    await new Promise((r) => probe.close(r));
    const { sender } = fakeSender();

    expect(await tunnel.listen(sender, busyPort, savedPort)).toBe(savedPort);
  });

  it("friend side: holds incoming bytes until resumed, then relays both ways", async () => {
    const { sender, events, next } = fakeSender();
    const port = await tunnel.listen(sender, 0);

    const opened = next("p2p:tcp-open");
    const minecraft = connect({ host: "127.0.0.1", port });
    const [, connId] = await opened;
    minecraft.write("hello");
    await new Promise((r) => setTimeout(r, 50));
    expect(events.some(([channel]) => channel === "p2p:tcp-data")).toBe(false);

    const data = next("p2p:tcp-data");
    tunnel.resume(connId);
    expect(Buffer.from((await data)[2]!).toString()).toBe("hello");

    const reply = once(minecraft, "data");
    tunnel.write(connId, Buffer.from("world"));
    expect(String((await reply)[0])).toBe("world");

    const closed = next("p2p:tcp-close");
    tunnel.closeAll();
    expect((await closed)[1]).toBe(connId);
    minecraft.destroy();
  });

  it("host side: pipes a remote connection into the local server", async () => {
    const echo = createServer((socket: Socket) => socket.pipe(socket));
    servers.push(echo);
    const echoPort = await listenOnRandomPort(echo);
    const { sender, next } = fakeSender();
    const connId = "3cb5418f-9a8b-400e-95c0-ca65d3b3de52";

    tunnel.connectToServer(sender, connId, echoPort);
    tunnel.resume(connId);
    const data = next("p2p:tcp-data");
    tunnel.write(connId, Buffer.from("ping"));

    expect(Buffer.from((await data)[2]!).toString()).toBe("ping");
  });
});
