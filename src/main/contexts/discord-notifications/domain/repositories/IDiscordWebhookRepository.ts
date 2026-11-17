export interface DiscordWebhookPayload {
  content: string;
  username?: string;
  allowed_mentions: { parse: [] };
}

export interface IDiscordWebhookRepository {
  enqueue(url: string, payload: DiscordWebhookPayload): void;
  /** Rejects with an Error whose message is safe to show (never contains the URL). */
  sendNow(url: string, payload: DiscordWebhookPayload): Promise<void>;
}
