import {
  readSecureJson,
  removeSecureJson,
  writeSecureJson,
} from "@main/contexts/p2p-tunnel/infrastructure/SecureStore";

const API_URL =
  import.meta.env.MAIN_VITE_API_URL ?? "https://pass-the-host-api.johannvasquez101.workers.dev";
const SESSION_FILE = "p2p-session";

interface DeviceSession {
  token: string;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, init);
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw Object.assign(new Error(error?.error ?? `http_${res.status}`), { status: res.status });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

let registering: Promise<string> | null = null;

/** Each install identifies itself with a token the API issues on first use; there is no login. */
function deviceToken(): Promise<string> {
  const saved = readSecureJson<DeviceSession>(SESSION_FILE);
  if (saved) return Promise.resolve(saved.token);
  // Calls racing on first launch share one registration instead of creating several users
  registering ??= request<DeviceSession>("/auth/device", { method: "POST" })
    .then((session) => {
      writeSecureJson(SESSION_FILE, session);
      return session.token;
    })
    .finally(() => (registering = null));
  return registering;
}

export async function api<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await deviceToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    return await request<T>(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // A rejected token can't recover: drop it so the next call registers this device again
    if ((error as { status?: number }).status === 401) removeSecureJson(SESSION_FILE);
    throw error;
  }
}
