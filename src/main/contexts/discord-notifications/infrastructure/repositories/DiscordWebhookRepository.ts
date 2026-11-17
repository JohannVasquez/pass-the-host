import { logger } from "@shared/infrastructure/logger";
import {
  DiscordWebhookPayload,
  IDiscordWebhookRepository,
} from "@main/contexts/discord-notifications/domain/repositories";

const MAX_RETRIES = 3;
const MAX_PENDING = 100;
// A longer wait would stall every message behind it: drop after the retries instead
const MAX_RETRY_AFTER_MS = 60_000;

interface Job {
  url: string;
  payload: DiscordWebhookPayload;
  /** Test messages still try a webhook marked dead */
  force: boolean;
  resolve: () => void;
  reject: (e: Error) => void;
}

export class DiscordWebhookRepository implements IDiscordWebhookRepository {
  private queue: Job[] = [];
  private running = false;
  // Discord docs: stop using a webhook that answers 401/403/404, repeated invalid requests get the IP restricted
  private dead = new Set<string>();

  constructor(
    private fetchFn: typeof fetch = (...a) => fetch(...a),
    private sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  enqueue(url: string, payload: DiscordWebhookPayload): void {
    this.push(url, payload, false).catch(() => {});
  }

  sendNow(url: string, payload: DiscordWebhookPayload): Promise<void> {
    return this.push(url, payload, true);
  }

  private push(url: string, payload: DiscordWebhookPayload, force: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.queue.length >= MAX_PENDING) {
        const dropped = this.queue.shift();
        dropped?.reject(new Error("Discord queue full"));
        logger.warn("Discord webhook queue full, dropping oldest message");
      }
      this.queue.push({ url, payload, force, resolve, reject });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let job: Job | undefined;
      while ((job = this.queue.shift())) {
        if (!job.force && this.dead.has(job.url)) {
          job.reject(new Error("Discord webhook is no longer valid"));
          continue;
        }
        try {
          await this.deliver(job);
          job.resolve();
        } catch (e) {
          job.reject(e instanceof Error ? e : new Error("Discord request failed"));
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(job: Job): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchFn(job.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(job.payload),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e) {
        // Never log the URL; fetch errors only carry a short reason.
        const reason = e instanceof Error ? e.name : "error";
        logger.warn(`Discord webhook request failed (${reason})`);
        throw new Error("Network error contacting Discord");
      }
      if (res.ok) {
        this.dead.delete(job.url);
        return;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.dead.add(job.url);
        logger.warn(`Discord webhook rejected (HTTP ${res.status}): paused until it is changed or tested`);
        throw new Error(`Discord responded with HTTP ${res.status}`);
      }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        await this.sleep(await this.retryAfterMs(res));
        continue;
      }
      logger.warn(`Discord webhook rejected the request (HTTP ${res.status})`);
      throw new Error(`Discord responded with HTTP ${res.status}`);
    }
  }

  private async retryAfterMs(res: Response): Promise<number> {
    let secs = NaN;
    try {
      secs = Number(((await res.json()) as { retry_after?: number }).retry_after);
    } catch {
      /* fall through to header */
    }
    if (!Number.isFinite(secs)) secs = Number(res.headers.get("Retry-After"));
    if (!Number.isFinite(secs) || secs < 0) secs = 1;
    return Math.min(Math.ceil(secs * 1000), MAX_RETRY_AFTER_MS);
  }
}
