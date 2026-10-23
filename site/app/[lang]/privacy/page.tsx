import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "../../dictionaries";
import { isLocale } from "../../i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).privacy;
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: {
      canonical: `/${lang}/privacy`,
      languages: {
        es: "/es/privacy",
        en: "/en/privacy",
        "x-default": "/privacy",
      },
    },
    openGraph: { url: `/${lang}/privacy` },
  };
}

export default async function PassTheHostPrivacy({
  params,
}: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).privacy;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6 leading-relaxed text-[#A1A1AA] [&_h1]:text-[#EAEAEA] [&_h2]:text-[#EAEAEA] [&_h2]:pt-4">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="text-sm opacity-70">{t.updated}</p>

      <p>{t.intro}</p>

      {t.sections.map((s) => (
        <section key={s.h} className="space-y-6">
          <h2 className="text-xl font-semibold">{s.h}</h2>
          <p>{s.p}</p>
        </section>
      ))}

      <h2 className="text-xl font-semibold">{t.revokeTitle}</h2>
      <p>
        {t.revokeText}{" "}
        <a
          className="text-[#A3D98A] underline"
          href="https://myaccount.google.com/permissions"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold">{t.contactTitle}</h2>
      <p>
        <a className="text-[#A3D98A] underline" href="mailto:johann@jvdev.cl">
          johann@jvdev.cl
        </a>
      </p>
    </main>
  );
}
