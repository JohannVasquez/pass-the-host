import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ptBR } from "./locales/pt-BR";
import { ru } from "./locales/ru";

// Shown in the language menu, each in its own language
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
] as const;

// Russian also needs _few/_many plural forms; its strings read the same for any count
// ("Установлено модов: {{count}}"), so reuse each _other instead of a key per form
function withRussianPlurals<T extends object>(node: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = typeof value === "string" ? value : withRussianPlurals(value);
    if (typeof value === "string" && key.endsWith("_other")) {
      const base = key.slice(0, -"_other".length);
      out[`${base}_few`] = value;
      out[`${base}_many`] = value;
    }
  }
  return out as T;
}

i18n.use(initReactI18next).init({
  resources: {
    en,
    es,
    "pt-BR": ptBR,
    de,
    fr,
    ru: withRussianPlurals(ru),
  },
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
