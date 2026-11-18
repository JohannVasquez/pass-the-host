import { unemojify } from "node-emoji";
import { discordMessages } from "@main/contexts/discord-notifications/domain/messages";

/** A `message` frame of the Worker's stream (see the Discord bridge contract) */
export interface DiscordChatMessage {
  author?: string;
  content?: string;
  replyTo?: string;
  attachments?: { kind?: string; url?: string; name?: string }[];
  stickers?: string[];
}

type Component = {
  text: string;
  color?: string;
  underlined?: boolean;
  click_event?: { action: "open_url"; url: string };
  clickEvent?: { action: "open_url"; value: string };
};

const MAX_VISIBLE = 256;
// Discord CDN links carry signed query strings (~250 chars); anything longer is shown but not clickable
const MAX_CLICK_URL = 2048;
const URL_RE = /https?:\/\/[^\s<>"]+/g;
const GIF_HOSTS = /(^|\.)(tenor|giphy)\.com$/i;

/** Click events were renamed in 1.21.5; unparsable versions (snapshots) are treated as new. */
export function usesNewClickEvent(version?: string): boolean {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version ?? "");
  if (!m) return true;
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (major !== 1) return major > 1;
  return minor > 21 || (minor === 21 && patch >= 5);
}

/** One line of plain text: no control chars (newline -> space), no § formatting codes */
function clean(s: string): string {
  return (
    s
      .replace(/[\r\n\u2028\u2029]+/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f§]/g, "")
      .replace(/\s+/g, " ")
  );
}

/** Custom Discord emoji first (unemojify doesn't know them), then unicode emoji -> :shortcode: */
const withEmoji = (s: string): string => unemojify(s.replace(/<a?:(\w+):\d+>/g, ":$1:"));

/**
 * Turns a Discord message into a `tellraw @a [...]` command, or null when there is nothing to show.
 * Built from objects + JSON.stringify so no user text can break out of the JSON.
 */
export function discordToGame(
  msg: DiscordChatMessage,
  opts: { language?: string; minecraftVersion?: string } = {},
): string | null {
  const labels = discordMessages(opts.language).game;
  const newClick = usesNewClickEvent(opts.minecraftVersion);
  const parts: Component[] = [];
  let left = MAX_VISIBLE;
  let full = false;

  // Adds visible text within the 256 char budget; returns the part (or null once the budget is gone)
  const push = (text: string, extra: Partial<Component> = {}): void => {
    if (full || !text) return;
    if (text.length > left) {
      text = text.slice(0, Math.max(0, left - 1)) + "…";
      full = true;
    }
    left -= text.length;
    parts.push({ text, ...extra });
  };
  const link = (text: string, url: string): void => {
    let href: string;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      href = u.href;
    } catch {
      return push(text, { color: "aqua" });
    }
    const click =
      href.length > MAX_CLICK_URL
        ? {}
        : newClick
          ? { click_event: { action: "open_url" as const, url: href } }
          : { clickEvent: { action: "open_url" as const, value: href } };
    push(text, { color: "aqua", underlined: true, ...click });
  };

  const author = clean(msg.author ?? "").trim() || "?";
  push("[Discord] ", { color: "blue" });
  push(withEmoji(author), { color: "white" });
  const reply = clean(msg.replyTo ?? "").trim();
  if (reply) {
    push(" → ", { color: "gray" });
    push(withEmoji(reply), { color: "white" });
  }
  push(": ", { color: "gray" });

  let shown = false;
  const content = clean(typeof msg.content === "string" ? msg.content : "");
  let last = 0;
  const text = (t: string): void => {
    const s = withEmoji(t);
    if (s.trim()) shown = true;
    push(s, { color: "white" });
  };
  for (const m of content.matchAll(URL_RE)) {
    // Trailing punctuation belongs to the sentence, not the link
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    text(content.slice(last, m.index));
    last = m.index + url.length;
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      /* shown as plain text below */
    }
    shown = true;
    link(GIF_HOSTS.test(host) ? labels.gif : url, url);
  }
  text(content.slice(last));

  for (const a of (msg.attachments ?? []).slice(0, 5)) {
    const label = labels[a?.kind === "image" || a?.kind === "gif" || a?.kind === "video" ? a.kind : "file"];
    if (typeof a?.url !== "string") continue;
    shown = true;
    push(" ");
    link(label, a.url);
  }
  for (const name of (msg.stickers ?? []).slice(0, 3)) {
    if (typeof name !== "string") continue;
    shown = true;
    push(" ");
    push(labels.sticker(clean(name).trim() || "?"), { color: "gray" });
  }

  if (!shown) return null;
  return `tellraw @a ${JSON.stringify(parts)}`;
}
