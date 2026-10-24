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

i18n.use(initReactI18next).init({
  resources: {
    en,
    es,
    "pt-BR": ptBR,
    de,
    fr,
    ru,
  },
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
