export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export const isLocale = (value: string | undefined): value is Locale =>
  locales.includes(value as Locale);

// An explicit choice (cookie set by the language switcher) wins over the
// browser language; anything that isn't Spanish falls back to English.
export function pickLocale(
  acceptLanguage: string | null,
  cookie: string | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;

  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().toLowerCase().split(";q=");
      return { tag, q: q === undefined ? 1 : Number(q) };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const match = locales.find((l) => tag === l || tag.startsWith(`${l}-`));
    if (match) return match;
  }
  return "en";
}
