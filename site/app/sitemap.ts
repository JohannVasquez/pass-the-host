import type { MetadataRoute } from "next";
import { locales } from "./i18n";

const BASE_URL = "https://passthehost.jvdev.cl";

const pages = [
  { path: "", changeFrequency: "monthly", priority: 1 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap(({ path, changeFrequency, priority }) =>
    locales.map((lang) => ({
      url: `${BASE_URL}/${lang}${path}`,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${BASE_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
