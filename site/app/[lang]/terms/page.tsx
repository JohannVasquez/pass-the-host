import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "../../dictionaries";
import { isLocale } from "../../i18n";
import { DocSections } from "../DocSections";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).terms;
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: {
      canonical: `/${lang}/terms`,
      languages: { es: "/es/terms", en: "/en/terms", "x-default": "/terms" },
    },
    openGraph: { url: `/${lang}/terms` },
  };
}

export default async function PassTheHostTerms({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).terms;

  return (
    <DocSections title={t.title} updated={t.updated} intro={t.intro} sections={t.sections}>
      <h2 className="text-xl font-semibold">{t.contactTitle}</h2>
      <p>
        <a className="text-[#A3D98A] underline" href="mailto:johann@jvdev.cl">
          johann@jvdev.cl
        </a>
      </p>
    </DocSections>
  );
}
