/** Texts of the webhook notices (chat is relayed as written, never translated) */
export const DISCORD_LANGUAGES = ["en", "es", "pt-BR", "de", "fr", "ru"] as const;
export type DiscordLanguage = (typeof DISCORD_LANGUAGES)[number];

export const resolveDiscordLanguage = (lang?: string): DiscordLanguage =>
  DISCORD_LANGUAGES.find((l) => l === lang) ?? "en";

interface DiscordMessages {
  online: (server: string) => string;
  stopped: (server: string) => string;
  crashed: (server: string, code: number) => string;
  joined: (player: string, server: string) => string;
  left: (player: string, server: string) => string;
  test: () => string;
}

const MESSAGES: Record<DiscordLanguage, DiscordMessages> = {
  en: {
    online: (s) => `🟢 **${s}** is online`,
    stopped: (s) => `🔴 **${s}** stopped`,
    crashed: (s, c) => `⚠️ **${s}** stopped unexpectedly (exit code ${c})`,
    joined: (p, s) => `➡️ **${p}** joined **${s}**`,
    left: (p, s) => `⬅️ **${p}** left **${s}**`,
    test: () => "✅ Pass the host is connected to this channel.",
  },
  es: {
    online: (s) => `🟢 **${s}** está en línea`,
    stopped: (s) => `🔴 **${s}** se detuvo`,
    crashed: (s, c) => `⚠️ **${s}** se detuvo inesperadamente (código de salida ${c})`,
    joined: (p, s) => `➡️ **${p}** entró a **${s}**`,
    left: (p, s) => `⬅️ **${p}** salió de **${s}**`,
    test: () => "✅ Pass the host está conectado a este canal.",
  },
  "pt-BR": {
    online: (s) => `🟢 **${s}** está online`,
    stopped: (s) => `🔴 **${s}** parou`,
    crashed: (s, c) => `⚠️ **${s}** parou inesperadamente (código de saída ${c})`,
    joined: (p, s) => `➡️ **${p}** entrou em **${s}**`,
    left: (p, s) => `⬅️ **${p}** saiu de **${s}**`,
    test: () => "✅ O Pass the host está conectado a este canal.",
  },
  de: {
    online: (s) => `🟢 **${s}** ist online`,
    stopped: (s) => `🔴 **${s}** wurde gestoppt`,
    crashed: (s, c) => `⚠️ **${s}** wurde unerwartet beendet (Exit-Code ${c})`,
    joined: (p, s) => `➡️ **${p}** ist **${s}** beigetreten`,
    left: (p, s) => `⬅️ **${p}** hat **${s}** verlassen`,
    test: () => "✅ Pass the host ist mit diesem Kanal verbunden.",
  },
  fr: {
    online: (s) => `🟢 **${s}** est en ligne`,
    stopped: (s) => `🔴 **${s}** s'est arrêté`,
    crashed: (s, c) => `⚠️ **${s}** s'est arrêté de façon inattendue (code de sortie ${c})`,
    joined: (p, s) => `➡️ **${p}** a rejoint **${s}**`,
    left: (p, s) => `⬅️ **${p}** a quitté **${s}**`,
    test: () => "✅ Pass the host est connecté à ce salon.",
  },
  ru: {
    online: (s) => `🟢 **${s}** запущен`,
    stopped: (s) => `🔴 **${s}** остановлен`,
    crashed: (s, c) => `⚠️ **${s}** неожиданно остановился (код выхода ${c})`,
    joined: (p, s) => `➡️ **${p}** зашёл на **${s}**`,
    left: (p, s) => `⬅️ **${p}** покинул **${s}**`,
    test: () => "✅ Pass the host подключён к этому каналу.",
  },
};

export const discordMessages = (lang?: string): DiscordMessages =>
  MESSAGES[resolveDiscordLanguage(lang)];
