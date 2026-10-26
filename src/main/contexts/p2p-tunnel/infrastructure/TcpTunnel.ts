import { createServer, connect, Server, Socket, AddressInfo } from "net";
import { randomUUID } from "crypto";
import type { WebContents } from "electron";
import { logger } from "@shared/infrastructure/logger";

// TCP side of the tunnel. The WebRTC side lives in the renderer; bytes cross over IPC keyed by connId.
const sockets = new Map<string, Socket>();
let server: Server | null = null;

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

/** Friend side: local port Minecraft connects to. Falls back to a free port if the preferred one is taken. */
export function listen(sender: WebContents, preferredPort: number): Promise<number> {
  closeAll();
  return new Promise((resolve, reject) => {
    const tcpServer = createServer((socket) => {
      const connId = randomUUID();
      pipe(sender, connId, socket);
      sender.send("p2p:tcp-open", connId);
    });
    tcpServer.on("listening", () => {
      server = tcpServer;
      resolve((tcpServer.address() as AddressInfo).port);
    });
    tcpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EADDRINUSE" || preferredPort === 0) return reject(error);
      preferredPort = 0;
      tcpServer.listen(0, "127.0.0.1");
    });
    tcpServer.listen(preferredPort, "127.0.0.1");
  });
}

/** Host side: one socket into the local Minecraft server per remote connection. */
export function connectToServer(sender: WebContents, connId: string, port: number): void {
  pipe(sender, connId, connect({ host: "127.0.0.1", port }));
}

export const write = (connId: string, data: Uint8Array): void =>
  void sockets.get(connId)?.write(data);
export const end = (connId: string): void => void sockets.get(connId)?.end();
export const pause = (connId: string): void => void sockets.get(connId)?.pause();
export const resume = (connId: string): void => void sockets.get(connId)?.resume();

// ponytail: one tunnel per app (you either host or join), so closing tears down everything.
export function closeAll(): void {
  server?.close();
  server = null;
  for (const socket of sockets.values()) socket.destroy();
  sockets.clear();
}
