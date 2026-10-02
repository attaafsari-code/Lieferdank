export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="container-page max-w-3xl pt-16 pb-10 text-center sm:pt-20">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-3 text-4xl font-extrabold break-words hyphens-auto text-brand-900 sm:text-5xl">{title}</h1>
      {lead && (
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{lead}</p>
      )}
    </div>
  );
}

/** Fließtext-Container für Rechtstexte und Erklärseiten. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page max-w-3xl pb-24 text-[1.0625rem] leading-relaxed [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-brand-900 [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:font-bold [&_h3]:text-ink [&_li]:mb-2 [&_p]:mb-4 [&_p]:text-ink-soft [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-ink-soft">
      {children}
    </div>
  );
}
