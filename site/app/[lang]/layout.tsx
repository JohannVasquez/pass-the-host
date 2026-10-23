import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiGithub } from "react-icons/si";
import { getDictionary } from "../dictionaries";
import { DownloadButton } from "../DownloadButton";
import { isLocale, locales } from "../i18n";
import icon from "../icon.png";
import { GITHUB_URL, getDownloads } from "../links";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const dynamicParams = false;
export const generateStaticParams = () => locales.map((lang) => ({ lang }));

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);

  return {
    metadataBase: new URL("https://passthehost.jvdev.cl"),
    title: { default: t.meta.title, template: "%s — Pass the host" },
    description: t.meta.description,
    applicationName: "Pass the host",
    authors: [{ name: "Johann Vásquez", url: "https://jvdev.cl" }],
    creator: "Johann Vásquez",
    // og:image and twitter:image come from [lang]/opengraph-image.tsx
    openGraph: {
      type: "website",
      url: `/${lang}`,
      locale: t.meta.ogLocale,
      siteName: "Pass the host",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const downloads = await getDownloads();

  return (
    <html lang={lang} className={geistSans.variable}>
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-[#0F1115]/90 backdrop-blur-sm border-b border-white/5">
          <nav
            className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4"
            aria-label={t.nav.label}
          >
            <Link
              href={`/${lang}`}
              className="flex shrink-0 items-center gap-2.5 font-semibold text-[#EAEAEA]"
            >
              <Image
                src={icon}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="hidden min-[400px]:inline">Pass the host</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-6 text-sm text-[#A1A1AA]">
              <Link
                href={`/${lang}#how-it-works`}
                className="hidden sm:inline hover:text-[#EAEAEA] transition-colors"
              >
                {t.nav.howItWorks}
              </Link>
              <Link
                href={`/${lang}#faq`}
                className="hidden md:inline hover:text-[#EAEAEA] transition-colors"
              >
                {t.nav.faq}
              </Link>
              <a
                href={GITHUB_URL}
                aria-label="GitHub"
                title="GitHub"
                className="flex hover:text-[#EAEAEA] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <SiGithub aria-hidden className="h-5 w-5" />
              </a>
              <LanguageSwitcher lang={lang} label={t.languageLabel} />
              <DownloadButton
                downloads={downloads}
                labels={t.download}
                showOS={false}
                className="rounded-lg bg-[#8BCB6B] px-3.5 py-1.5 font-medium text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
              />
            </div>
          </nav>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-white/5 py-8 text-sm text-[#A1A1AA]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-4 justify-between">
            <p>
              {t.footer.madeBy}{" "}
              <a
                href="https://jvdev.cl"
                className="text-[#EAEAEA] hover:text-[#8BCB6B]"
              >
                Johann Vásquez
              </a>
              . {t.footer.license}
            </p>
            <div className="flex items-center gap-6">
              <Link href={`/${lang}/privacy`} className="hover:text-[#EAEAEA]">
                {t.footer.privacy}
              </Link>
              <a
                href={GITHUB_URL}
                aria-label="GitHub"
                title="GitHub"
                className="flex hover:text-[#EAEAEA]"
              >
                <SiGithub aria-hidden className="h-5 w-5" />
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
