"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, locales } from "../i18n";

// The cookie makes the root redirect (proxy.ts) remember the explicit choice
export function LanguageSwitcher({
  lang,
  label,
}: {
  lang: Locale;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-lg border border-white/10 p-0.5 text-xs font-medium"
    >
      {locales.map((l) =>
        l === lang ? (
          <span
            key={l}
            aria-current="true"
            className="rounded-md bg-white/10 px-2 py-1 text-[#EAEAEA]"
          >
            {l.toUpperCase()}
          </span>
        ) : (
          <Link
            key={l}
            href={pathname.replace(/^\/[^/]+/, `/${l}`)}
            hrefLang={l}
            lang={l}
            // Both languages share the same layout: stay where the reader is
            scroll={false}
            onClick={() => {
              document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
            }}
            className="rounded-md px-2 py-1 hover:text-[#EAEAEA] transition-colors"
          >
            {l.toUpperCase()}
          </Link>
        ),
      )}
    </div>
  );
}
