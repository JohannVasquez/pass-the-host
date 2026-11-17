// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[@-Z\\-_]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

const MAX_PENDING = 16 * 1024;

export class LineBuffer {
  private tail = "";

  push(chunk: string): string[] {
    const parts = (this.tail + chunk).split("\n");
    this.tail = (parts.pop() ?? "").slice(-MAX_PENDING);
    return parts.map((l) => l.replace(/\r$/, ""));
  }

  flush(): string[] {
    const rest = this.tail.replace(/\r$/, "");
    this.tail = "";
    return rest ? [rest] : [];
  }
}

export type ServerEvent =
  | { type: "chat"; player: string; message: string }
  | { type: "started" }
  | { type: "joined" | "left"; player: string };

// One or more "[...]" groups (one of them INFO), then ": "
const PREFIX_RE = /^\s*((?:\[[^\]]*\]\s*)+):\s(.*)$/;
const INFO_RE = /(?:^|[\s/])INFO$/;
const GROUP_RE = /\[([^\]]*)\]/g;
const NAME = "[A-Za-z0-9_]{1,16}";
const CHAT_RE = new RegExp(`^(?:\\[Not Secure\\] )?<(${NAME})> (.+)$`);
const JOIN_RE = new RegExp(`^(${NAME}) joined the game$`);
const LEFT_RE = new RegExp(`^(${NAME}) left the game$`);
const DONE_RE = /^Done \(\d+(?:[.,]\d+)?s\)! For help, type "help"/;

export function parseServerLine(line: string): ServerEvent | null {
  const m = PREFIX_RE.exec(stripAnsi(line).trim());
  if (!m) return null;
  const groups = [...m[1].matchAll(GROUP_RE)].map((g) => g[1]);
  if (!groups.some((g) => INFO_RE.test(g))) return null;
  const body = m[2].trim();
  let r: RegExpExecArray | null;
  if ((r = CHAT_RE.exec(body))) return { type: "chat", player: r[1], message: r[2] };
  if ((r = JOIN_RE.exec(body))) return { type: "joined", player: r[1] };
  if ((r = LEFT_RE.exec(body))) return { type: "left", player: r[1] };
  if (DONE_RE.test(body)) return { type: "started" };
  return null;
}

export function sanitizeMentions(text: string): string {
  return text.replace(/@(everyone|here)/gi, "@​$1");
}

export function truncate(text: string, max = 2000): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

const WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);

export function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      WEBHOOK_HOSTS.has(u.hostname) &&
      /^\/api\/webhooks\/[^/]+\/[^/]+/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function discordUsername(player: string): string | null {
  return /discord|clyde/i.test(player) ? null : player;
}
