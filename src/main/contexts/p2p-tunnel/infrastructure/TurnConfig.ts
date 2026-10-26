import { logger } from "@shared/infrastructure/logger";
import {
  readSecureJson,
  removeSecureJson,
  writeSecureJson,
} from "@main/contexts/p2p-tunnel/infrastructure/SecureStore";

export type TurnConfig =
  | { type: "cloudflare"; keyId: string; apiToken: string }
  | { type: "static"; urls: string[]; username: string; credential: string };

const TURN_FILE = "p2p-turn";
const TURN_URL = /^turns?:[^\s]+$/;
const CLOUDFLARE_KEY_ID = /^[0-9a-f]{32}$/i;
// Cloudflare caps credentials at 48 h, so they're minted per connection instead of stored
const CLOUDFLARE_TTL_S = 48 * 60 * 60;
// STUN is free; only relayed (TURN) traffic is metered
const PUBLIC_STUN: RTCIceServer = { urls: "stun:stun.cloudflare.com:3478" };

export const loadTurnConfig = (): TurnConfig | null => readSecureJson<TurnConfig>(TURN_FILE);

async function cloudflareIceServers(
  keyId: string,
  apiToken: string,
  ttl: number,
): Promise<RTCIceServer[]> {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl }),
    },
  );
  if (!res.ok) throw new Error(`cloudflare_turn_${res.status}`);
  const { iceServers } = (await res.json()) as { iceServers: RTCIceServer[] };
  // Browsers time out on port 53; Cloudflare recommends dropping those URLs
  return iceServers.map((server) => ({
    ...server,
    urls: [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url)),
  }));
}

/** Saves the user's own TURN server; `null` removes it. */
export async function saveTurnConfig(config: TurnConfig | null): Promise<void> {
  if (!config) return removeSecureJson(TURN_FILE);

  if (config.type === "cloudflare") {
    const keyId = config.keyId.trim();
    const apiToken = config.apiToken.trim();
    if (!CLOUDFLARE_KEY_ID.test(keyId) || !apiToken) throw new Error("invalid_turn_config");
    // Check the key works before saving it; a one-minute credential is enough
    await cloudflareIceServers(keyId, apiToken, 60).catch(() => {
      throw new Error("invalid_cloudflare_turn");
    });
    return writeSecureJson(TURN_FILE, { type: "cloudflare", keyId, apiToken });
  }

  const urls = config.urls.map((url) => url.trim()).filter(Boolean);
  const username = config.username.trim();
  if (
    urls.length === 0 ||
    !urls.every((url) => TURN_URL.test(url)) ||
    !username ||
    !config.credential
  ) {
    throw new Error("invalid_turn_config");
  }
  writeSecureJson(TURN_FILE, { type: "static", urls, username, credential: config.credential });
}

/** TURN is opt-in: without the user's own server, only direct (STUN) connections are attempted. */
export async function getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
  const config = loadTurnConfig();
  if (!config) return { iceServers: [PUBLIC_STUN] };
  if (config.type !== "cloudflare") {
    const { urls, username, credential } = config;
    return { iceServers: [PUBLIC_STUN, { urls, username, credential }] };
  }
  try {
    return {
      iceServers: await cloudflareIceServers(config.keyId, config.apiToken, CLOUDFLARE_TTL_S),
    };
  } catch (error) {
    // A direct connection may still work, so don't block the tunnel on TURN being unreachable
    logger.warn(`Cloudflare TURN unavailable: ${(error as Error).message}`);
    return { iceServers: [PUBLIC_STUN] };
  }
}
