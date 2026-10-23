import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LuBlocks,
  LuChartColumn,
  LuCloudUpload,
  LuCoffee,
  LuDownload,
  LuLock,
  LuPlay,
  LuRefreshCw,
  LuTerminal,
} from "react-icons/lu";
import { SiGithub } from "react-icons/si";
import { TbBucket } from "react-icons/tb";
import { getDictionary } from "../dictionaries";
import { DownloadButton } from "../DownloadButton";
import { isLocale } from "../i18n";
import icon from "../icon.png";
import { DOWNLOAD_URL, GITHUB_URL, getDownloads } from "../links";

const SITE_URL = "https://passthehost.jvdev.cl";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    title: { absolute: getDictionary(lang).meta.title },
    alternates: {
      canonical: `/${lang}`,
      // x-default is the root, which redirects by browser language
      languages: { es: "/es", en: "/en", "x-default": "/" },
    },
  };
}

// Icons in the same order as the dictionary's steps / features
const stepIcons = [LuRefreshCw, LuPlay, LuCloudUpload];
const featureIcons = [
  LuTerminal,
  LuLock,
  LuRefreshCw,
  LuBlocks,
  LuCoffee,
  LuChartColumn,
];

const providers = [
  "Cloudflare R2",
  "AWS S3",
  "MinIO",
  "Backblaze",
  "DigitalOcean",
];

// Official Google Drive mark (brand colors)
function GoogleDriveLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

export default async function PassTheHostPage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const downloads = await getDownloads();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Pass the host",
        url: `${SITE_URL}/${lang}`,
        description: t.meta.description,
        applicationCategory: "GameApplication",
        applicationSubCategory: "Minecraft server manager",
        operatingSystem: "Windows, macOS, Linux",
        ...(downloads.version && {
          softwareVersion: downloads.version.replace(/^v/, ""),
        }),
        downloadUrl: DOWNLOAD_URL,
        image: `${SITE_URL}/pass-the-host-home.png`,
        screenshot: [
          `${SITE_URL}/pass-the-host-home.png`,
          `${SITE_URL}/pass-the-host-create-server.png`,
        ],
        inLanguage: lang,
        license: "https://opensource.org/license/mit",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: t.features.items.map((f) => f.title),
        author: {
          "@type": "Person",
          name: "Johann Vásquez",
          url: "https://jvdev.cl",
        },
        sameAs: [GITHUB_URL],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/${lang}#faq`,
        inLanguage: lang,
        mainEntity: t.faq.items.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can't close the script tag
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#8BCB6B]/30 bg-[#8BCB6B]/10 px-3 py-1 text-sm text-[#A3D98A]">
            {t.hero.badge}
          </p>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-[#EAEAEA] text-balance">
            {t.hero.title}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[#A1A1AA] max-w-2xl text-pretty">
            {t.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DownloadButton
              downloads={downloads}
              labels={t.download}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8BCB6B] px-5 py-3 font-semibold text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
            >
              <LuDownload aria-hidden className="h-5 w-5" />
            </DownloadButton>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 font-semibold text-[#EAEAEA] hover:border-white/25 transition-colors"
            >
              <SiGithub aria-hidden className="h-5 w-5" />
              {t.hero.github}
            </a>
          </div>
          <p className="mt-4 text-sm text-[#A1A1AA]">
            {downloads.version && `${downloads.version} · `}
            {downloads.count &&
              `${t.hero.downloadCount.replace("{n}", downloads.count)} · `}
            {t.hero.platforms} ·{" "}
            <a
              href={DOWNLOAD_URL}
              className="underline underline-offset-4 hover:text-[#EAEAEA]"
            >
              {t.hero.allDownloads}
            </a>
          </p>
        </div>

        <div className="relative mt-14 sm:mt-20">
          <div
            aria-hidden
            className="absolute -inset-x-8 -top-8 bottom-0 bg-[radial-gradient(ellipse_at_top,rgba(139,203,107,0.18),transparent_65%)] blur-2xl"
          />
          <figure className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#181B23] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <Image
              src="/pass-the-host-home.png"
              alt={t.hero.screenshotAlt}
              width={3840}
              height={2036}
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="w-full h-auto"
              priority
            />
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-24 scroll-mt-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          {t.how.title}
        </h2>
        <p className="mt-3 text-[#A1A1AA] max-w-2xl">{t.how.subtitle}</p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {t.how.steps.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <li
                key={step.title}
                className="relative rounded-2xl border border-white/10 bg-[#181B23]/80 p-6"
              >
                <div className="flex items-center justify-between">
                  <Icon aria-hidden className="h-6 w-6 text-[#8BCB6B]" />
                  <span className="font-mono text-sm text-[#A1A1AA]">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[#EAEAEA]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[#A1A1AA]">{step.text}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-8 text-sm text-[#A1A1AA]">{t.how.connectNote}</p>
      </section>

      {/* Features */}
      <section className="border-y border-white/5 bg-[#181B23]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 grid gap-12 lg:grid-cols-[1fr_1.2fr] items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
              {t.features.title}
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {t.features.items.map((f, i) => {
                const Icon = featureIcons[i];
                return (
                  <div key={f.title}>
                    <Icon aria-hidden className="h-5 w-5 text-[#8BCB6B]" />
                    <h3 className="mt-3 font-semibold text-[#EAEAEA]">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#A1A1AA]">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <Image
              src="/pass-the-host-create-server.png"
              alt={t.features.screenshotAlt}
              width={3840}
              height={2036}
              sizes="(min-width: 1024px) 600px, 100vw"
              className="w-full h-auto"
            />
          </figure>
        </div>
      </section>

      {/* Storage */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          {t.storage.title}
        </h2>
        <p className="mt-3 text-[#A1A1AA] max-w-2xl">{t.storage.subtitle}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#181B23]/80 p-6">
            <div className="flex items-center gap-3">
              <TbBucket
                aria-hidden
                className="h-5 w-5 shrink-0 text-[#8BCB6B]"
              />
              <h3 className="text-lg font-semibold text-[#EAEAEA]">
                {t.storage.s3Title}
              </h3>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#8BCB6B]/15 px-2.5 py-0.5 text-xs text-[#A3D98A]">
                {t.storage.s3Badge}
              </span>
            </div>
            <p className="mt-2 text-[#A1A1AA]">{t.storage.s3Text}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {providers.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-white/10 px-3 py-1 text-sm text-[#EAEAEA]"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#8BCB6B]/30 bg-[#8BCB6B]/[0.06] p-6">
            <div className="flex items-center gap-3">
              <GoogleDriveLogo className="h-5 w-5 shrink-0" />
              <h3 className="text-lg font-semibold text-[#EAEAEA]">
                Google Drive
              </h3>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#8BCB6B]/15 px-2.5 py-0.5 text-xs text-[#A3D98A]">
                {t.storage.driveBadge}
              </span>
            </div>
            <p className="mt-2 text-[#A1A1AA]">{t.storage.driveText}</p>
            <p className="mt-4 text-sm text-[#A1A1AA]">
              {t.storage.driveNote}{" "}
              <Link
                href={`/${lang}/privacy`}
                className="text-[#A3D98A] underline underline-offset-4"
              >
                {t.footer.privacy}
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 scroll-mt-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-[#EAEAEA]">
          {t.faq.title}
        </h2>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {t.faq.items.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#EAEAEA] [&::-webkit-details-marker]:hidden">
                <h3>{f.q}</h3>
                <span
                  aria-hidden
                  className="text-xl text-[#8BCB6B] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[#A1A1AA]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-[#181B23] px-6 py-14 text-center">
          <Image
            src={icon}
            alt=""
            width={72}
            height={72}
            className="mx-auto rounded-full"
          />
          <h2 className="mt-6 text-3xl font-bold text-[#EAEAEA]">
            {t.cta.title}
          </h2>
          <p className="mt-3 text-[#A1A1AA]">{t.cta.text}</p>
          <DownloadButton
            downloads={downloads}
            labels={t.download}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#8BCB6B] px-5 py-3 font-semibold text-[#0F1115] hover:bg-[#A3D98A] transition-colors"
          >
            <LuDownload aria-hidden className="h-5 w-5" />
          </DownloadButton>
        </div>
      </section>
    </main>
  );
}
