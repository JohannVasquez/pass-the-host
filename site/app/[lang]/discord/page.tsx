import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../dictionaries";
import { isLocale } from "../../i18n";
import { DocSections } from "../DocSections";

// The bot's install link in the Discord Developer Portal points here: linking only works from the app
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/discord">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).discord;
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: {
      canonical: `/${lang}/discord`,
      languages: { es: "/es/discord", en: "/en/discord", "x-default": "/discord" },
    },
    openGraph: { url: `/${lang}/discord` },
  };
}

export default async function PassTheHostDiscord({ params }: PageProps<"/[lang]/discord">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.discord;

  return (
    <DocSections title={t.title} intro={t.intro} sections={t.sections}>
      <p className="pt-4">
        {t.privacyNote}{" "}
        <Link href={`/${lang}/privacy`} className="text-[#A3D98A] underline">
          {dict.footer.privacy}
        </Link>
        {" · "}
        <Link href={`/${lang}/terms`} className="text-[#A3D98A] underline">
          {dict.footer.terms}
        </Link>
      </p>
    </DocSections>
  );
}
