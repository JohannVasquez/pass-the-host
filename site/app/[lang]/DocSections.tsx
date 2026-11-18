// Shared body of the text-only pages (terms, Discord): a title, an intro and titled paragraphs
export function DocSections({
  title,
  updated,
  intro,
  sections,
  children,
}: {
  title: string;
  updated?: string;
  intro: string;
  sections: readonly { h: string; p: string }[];
  children?: React.ReactNode;
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6 leading-relaxed text-[#A1A1AA] [&_h1]:text-[#EAEAEA] [&_h2]:text-[#EAEAEA] [&_h2]:pt-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      {updated && <p className="text-sm opacity-70">{updated}</p>}
      <p>{intro}</p>
      {sections.map((s) => (
        <section key={s.h} className="space-y-6">
          <h2 className="text-xl font-semibold">{s.h}</h2>
          <p>{s.p}</p>
        </section>
      ))}
      {children}
    </main>
  );
}
