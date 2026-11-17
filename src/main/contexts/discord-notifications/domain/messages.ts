/** Texts of the webhook notices (chat is relayed as written, never translated) */
export const DISCORD_LANGUAGES = ["en", "es", "pt-BR", "de", "fr", "ru"] as const;
export type DiscordLanguage = (typeof DISCORD_LANGUAGES)[number];

export const resolveDiscordLanguage = (lang?: string): DiscordLanguage =>
  DISCORD_LANGUAGES.find((l) => l === lang) ?? "en";

interface DiscordMessages {
  /** `by`: the app nickname of whoever hosts the server, when known */
  online: (server: string, by?: string) => string;
  stopped: (server: string, by?: string) => string;
  crashed: (server: string, code: number, by?: string) => string;
  joined: (player: string, server: string) => string;
  left: (player: string, server: string) => string;
  test: () => string;
}

const MESSAGES: Record<DiscordLanguage, DiscordMessages> = {
  en: {
    online: (s, b) => (b ? `🟢 **${b}** started **${s}**` : `🟢 **${s}** is online`),
    stopped: (s, b) => (b ? `🔴 **${b}** stopped **${s}**` : `🔴 **${s}** stopped`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** stopped unexpectedly while **${b}** was hosting (exit code ${c})`
        : `⚠️ **${s}** stopped unexpectedly (exit code ${c})`,
    joined: (p, s) => `➡️ **${p}** joined **${s}**`,
    left: (p, s) => `⬅️ **${p}** left **${s}**`,
    test: () => "✅ Pass the host is connected to this channel.",
  },
  es: {
    online: (s, b) => (b ? `🟢 **${b}** inició **${s}**` : `🟢 **${s}** está en línea`),
    stopped: (s, b) => (b ? `🔴 **${b}** detuvo **${s}**` : `🔴 **${s}** se detuvo`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** se detuvo inesperadamente mientras **${b}** lo alojaba (código de salida ${c})`
        : `⚠️ **${s}** se detuvo inesperadamente (código de salida ${c})`,
    joined: (p, s) => `➡️ **${p}** entró a **${s}**`,
    left: (p, s) => `⬅️ **${p}** salió de **${s}**`,
    test: () => "✅ Pass the host está conectado a este canal.",
  },
  "pt-BR": {
    online: (s, b) => (b ? `🟢 **${b}** iniciou **${s}**` : `🟢 **${s}** está online`),
    stopped: (s, b) => (b ? `🔴 **${b}** parou **${s}**` : `🔴 **${s}** parou`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** parou inesperadamente enquanto **${b}** hospedava (código de saída ${c})`
        : `⚠️ **${s}** parou inesperadamente (código de saída ${c})`,
    joined: (p, s) => `➡️ **${p}** entrou em **${s}**`,
    left: (p, s) => `⬅️ **${p}** saiu de **${s}**`,
    test: () => "✅ O Pass the host está conectado a este canal.",
  },
  de: {
    online: (s, b) => (b ? `🟢 **${b}** hat **${s}** gestartet` : `🟢 **${s}** ist online`),
    stopped: (s, b) => (b ? `🔴 **${b}** hat **${s}** gestoppt` : `🔴 **${s}** wurde gestoppt`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** wurde unerwartet beendet, während **${b}** ihn hostete (Exit-Code ${c})`
        : `⚠️ **${s}** wurde unerwartet beendet (Exit-Code ${c})`,
    joined: (p, s) => `➡️ **${p}** ist **${s}** beigetreten`,
    left: (p, s) => `⬅️ **${p}** hat **${s}** verlassen`,
    test: () => "✅ Pass the host ist mit diesem Kanal verbunden.",
  },
  fr: {
    online: (s, b) => (b ? `🟢 **${b}** a démarré **${s}**` : `🟢 **${s}** est en ligne`),
    stopped: (s, b) => (b ? `🔴 **${b}** a arrêté **${s}**` : `🔴 **${s}** s'est arrêté`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** s'est arrêté de façon inattendue pendant que **${b}** l'hébergeait (code de sortie ${c})`
        : `⚠️ **${s}** s'est arrêté de façon inattendue (code de sortie ${c})`,
    joined: (p, s) => `➡️ **${p}** a rejoint **${s}**`,
    left: (p, s) => `⬅️ **${p}** a quitté **${s}**`,
    test: () => "✅ Pass the host est connecté à ce salon.",
  },
  ru: {
    online: (s, b) => (b ? `🟢 **${b}** запустил **${s}**` : `🟢 **${s}** запущен`),
    stopped: (s, b) => (b ? `🔴 **${b}** остановил **${s}**` : `🔴 **${s}** остановлен`),
    crashed: (s, c, b) =>
      b
        ? `⚠️ **${s}** неожиданно остановился, хост: **${b}** (код выхода ${c})`
        : `⚠️ **${s}** неожиданно остановился (код выхода ${c})`,
    joined: (p, s) => `➡️ **${p}** зашёл на **${s}**`,
    left: (p, s) => `⬅️ **${p}** покинул **${s}**`,
    test: () => "✅ Pass the host подключён к этому каналу.",
  },
};

export const discordMessages = (lang?: string): DiscordMessages =>
  MESSAGES[resolveDiscordLanguage(lang)];

/** A nickname typed in the app, made safe to drop into a bold markdown span */
export const safeNickname = (name: string | null | undefined): string | undefined => {
  const clean = (name ?? "")
    .replace(/[\\*_~`|>]/g, "")
    .replace(/@/g, "@\u200b")
    .trim()
    .slice(0, 32);
  return clean || undefined;
};
