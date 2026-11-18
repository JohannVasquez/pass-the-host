import { logger } from "@shared/infrastructure/logger";
import { DiscordSettings } from "@main/contexts/discord-notifications/domain/entities";
import { discordToGame } from "@main/contexts/discord-notifications/domain/discordToGame";

const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];
const PING_MS = 30_000;
const SILENCE_MS = 90_000;
// The Worker closes the socket after these; retrying would only repeat the failure
const FATAL = new Set(["unauthorized", "invalid_link", "link_pending", "bot_removed"]);

interface Session {
  serverId: string;
  stopped: boolean;
  attempt: number;
  ws?: WebSocket;
  ping?: ReturnType<typeof setInterval>;
  watchdog?: ReturnType<typeof setTimeout>;
  retry?: ReturnType<typeof setTimeout>;
}

export interface DiscordBridgeDeps {
  loadSettings: (serverId: string) => DiscordSettings;
  serverVersion: (serverId: string) => string | undefined;
  sendCommand: (serverId: string, command: string) => Promise<unknown>;
  /** Base URL of the API (http(s)://...) */
  apiUrl: string;
  deviceToken: () => Promise<string>;
}

/** Holds the WebSocket to the Worker while a server is online and feeds Discord messages into its chat. */
export class DiscordBridge {
  private sessions = new Map<string, Session>();

  constructor(private deps: DiscordBridgeDeps) {}

  onLifecycle(serverId: string, event: "online" | "stopped"): void {
    if (event === "stopped") return this.stop(serverId);
    this.stop(serverId);
    const s = this.deps.loadSettings(serverId);
    if (!(s.relay_to_game && s.link_id && s.link_secret && s.channel_id)) return;
    const session: Session = { serverId, stopped: false, attempt: 0 };
    this.sessions.set(serverId, session);
    this.connect(session);
  }

  stop(serverId: string): void {
    const session = this.sessions.get(serverId);
    if (!session) return;
    this.sessions.delete(serverId);
    session.stopped = true;
    this.teardown(session);
    logger.info(`Discord bridge closed for ${serverId}`);
  }

  private teardown(session: Session): void {
    clearInterval(session.ping);
    clearTimeout(session.watchdog);
    clearTimeout(session.retry);
    const ws = session.ws;
    session.ws = undefined;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  private reconnect(session: Session): void {
    this.teardown(session);
    if (session.stopped) return;
    const delay = BACKOFF_MS[Math.min(session.attempt++, BACKOFF_MS.length - 1)];
    session.retry = setTimeout(() => this.connect(session), delay);
  }

  private fail(session: Session, code: string): void {
    logger.warn(`Discord bridge stopped for ${session.serverId}: ${code}`);
    this.teardown(session);
    session.stopped = true;
    this.sessions.delete(session.serverId);
  }

  private connect(session: Session): void {
    if (session.stopped) return;
    const s = this.deps.loadSettings(session.serverId);
    if (!(s.relay_to_game && s.link_id && s.link_secret)) return this.stop(session.serverId);
    const { link_id: linkId, link_secret: secret } = s;
    const url = `${this.deps.apiUrl.replace(/^http/, "ws")}/api/discord/stream`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      logger.warn("Discord bridge could not open the socket", e instanceof Error ? e.message : "");
      return this.reconnect(session);
    }
    session.ws = ws;
    const armWatchdog = (): void => {
      clearTimeout(session.watchdog);
      session.watchdog = setTimeout(() => {
        logger.warn(`Discord bridge silent for ${session.serverId}, reconnecting`);
        this.reconnect(session);
      }, SILENCE_MS);
    };
    ws.onopen = () => {
      this.deps
        .deviceToken()
        .then((token) => {
          if (session.ws !== ws) return;
          ws.send(JSON.stringify({ type: "hello", token, linkId, secret }));
          armWatchdog();
          session.ping = setInterval(() => {
            try {
              ws.send(JSON.stringify({ type: "ping" }));
            } catch {
              // closing: onclose reconnects
            }
          }, PING_MS);
        })
        .catch(() => this.session(session, ws) && this.reconnect(session));
    };
    ws.onmessage = (ev) => {
      armWatchdog();
      let frame: { type?: string; code?: string } & Record<string, unknown>;
      try {
        frame = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (frame.type === "ready") {
        session.attempt = 0;
        logger.info(`Discord bridge connected for ${session.serverId}`);
      } else if (frame.type === "message") {
        this.relay(session.serverId, frame);
      } else if (frame.type === "error" && typeof frame.code === "string") {
        if (FATAL.has(frame.code)) this.fail(session, frame.code);
        else {
          // bot_unavailable: the Worker only retries Discord when a client says hello again
          logger.warn(`Discord bridge error for ${session.serverId}: ${frame.code}`);
          this.reconnect(session);
        }
      }
    };
    ws.onerror = () => logger.warn(`Discord bridge socket error for ${session.serverId}`);
    ws.onclose = () => {
      if (session.ws !== ws) return;
      logger.info(`Discord bridge disconnected for ${session.serverId}`);
      this.reconnect(session);
    };
  }

  private session(session: Session, ws: WebSocket): boolean {
    return session.ws === ws && !session.stopped;
  }

  private relay(serverId: string, frame: object): void {
    const s = this.deps.loadSettings(serverId);
    if (!s.relay_to_game) return;
    const cmd = discordToGame(frame, {
      language: s.language,
      minecraftVersion: this.deps.serverVersion(serverId),
    });
    if (!cmd) return;
    // Logged without the text: enough to tell whether Discord messages reach the server
    this.deps
      .sendCommand(serverId, cmd)
      .then((sent) =>
        sent === false
          ? logger.warn(`Discord message not delivered to ${serverId}: server not running`)
          : logger.info(`Discord message relayed to ${serverId}`),
      )
      .catch((e) => logger.warn("Discord relay to game failed", e instanceof Error ? e.message : ""));
  }
}
