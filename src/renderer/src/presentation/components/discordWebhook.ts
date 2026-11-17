// Same rule as the main-process relay, which re-validates before sending.
const DISCORD_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

export const isValidWebhookUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      DISCORD_HOSTS.includes(url.hostname) &&
      /^\/api\/webhooks\/[^/]+\/[^/]+/.test(url.pathname)
    );
  } catch {
    return false;
  }
};
