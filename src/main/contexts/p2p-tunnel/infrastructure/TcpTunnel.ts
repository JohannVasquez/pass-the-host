import { createServer, connect, Server, Socket, AddressInfo } from "net";
import { randomUUID } from "crypto";
import type { WebContents } from "electron";
import { logger } from "@shared/infrastructure/logger";

// TCP side of the tunnel. The WebRTC side lives in the renderer; bytes cross over IPC keyed by connId.
const sockets = new Map<string, Socket>();
let servers: Server[] = [];

function pipe(sender: WebContents, connId: string, socket: Socket): void {
  sockets.set(connId, socket);
  socket.on("data", (data) => {
    if (!sender.isDestroyed()) sender.send("p2p:tcp-data", connId, data);
  });
  // Paused until the renderer's data channel is open (it calls resume)
  socket.pause();
  socket.on("error", (error) => logger.warn(`P2P socket ${connId}: ${error.message}`));
  socket.on("close", () => {
    sockets.delete(connId);
    if (!sender.isDestroyed()) sender.send("p2p:tcp-close", connId);
  });
}

/** "localhost" may resolve to ::1: listen there too on the same port. Failing (no IPv6, port taken) is fine. */
function listenIpv6(sender: WebContents, port: number): void {
  const tcpServer = createServer((socket) => {
    const connId = randomUUID();
    pipe(sender, connId, socket);
    sender.send("p2p:tcp-open", connId);
  });
  tcpServer.on("error", (error) => logger.warn(`P2P ::1 listener skipped: ${error.message}`));
  servers.push(tcpServer);
  tcpServer.listen(port, "::1");
}

/** Friend side: local port Minecraft connects to. Tries the preferred ports in order, then any free one. */
export function listen(sender: WebContents, ...preferredPorts: number[]): Promise<number> {
  closeAll();
  const candidates = [...preferredPorts.filter((port) => port > 0), 0];
  return new Promise((resolve, reject) => {
    const tcpServer = createServer((socket) => {
      const connId = randomUUID();
      pipe(sender, connId, socket);
      sender.send("p2p:tcp-open", connId);
    });
    tcpServer.on("listening", () => {
      servers.push(tcpServer);
      const port = (tcpServer.address() as AddressInfo).port;
      listenIpv6(sender, port);
      resolve(port);
    });
    tcpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EADDRINUSE" || candidates.length === 1) return reject(error);
      candidates.shift();
      tcpServer.listen(candidates[0], "127.0.0.1");
    });
    tcpServer.listen(candidates[0], "127.0.0.1");
  });
}

/** Host side: one socket into the local Minecraft server per remote connection. */
export function connectToServer(sender: WebContents, connId: string, port: number): void {
  const socket = connect({ host: "127.0.0.1", port });
  pipe(sender, connId, socket);
  socket.on("error", (error: NodeJS.ErrnoException) => {
    if (!sender.isDestroyed()) sender.send("p2p:tcp-error", connId, error.code ?? error.message);
  });
}

export const write = (connId: string, data: Uint8Array): void =>
  void sockets.get(connId)?.write(data);
export const end = (connId: string): void => void sockets.get(connId)?.end();
export const pause = (connId: string): void => void sockets.get(connId)?.pause();
export const resume = (connId: string): void => void sockets.get(connId)?.resume();

// ponytail: one tunnel per app (you either host or join), so closing tears down everything.
export function closeAll(): void {
  for (const tcpServer of servers) tcpServer.close();
  servers = [];
  for (const socket of sockets.values()) socket.destroy();
  sockets.clear();
}
