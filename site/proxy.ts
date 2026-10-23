import { type NextRequest, NextResponse } from "next/server";
import { isLocale, pickLocale } from "./app/i18n";

// Paths without a locale prefix (/, /privacy, old links) go to the
// visitor's language: their switcher choice, else the browser language.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isLocale(pathname.split("/")[1])) return;

  const locale = pickLocale(
    request.headers.get("accept-language"),
    request.cookies.get("NEXT_LOCALE")?.value,
  );
  const target = `/${locale}${pathname === "/" ? "" : pathname}${search}`;
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  // Skip Next internals and any file (icon.png, sitemap.xml, llms.txt, …)
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
