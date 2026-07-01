import Link from "next/link";

export function TerminalSectionView({
  eyebrow,
  title,
  description,
  cards,
  ctaHref = "/markets",
  ctaLabel = "Zum Marktterminal",
  statusLabel = "Demo / Providerstatus sichtbar",
  statusDescription = "Diese Seite liefert Produktnutzen, markiert aber lizenz- oder backendabhängige Funktionen klar als vorbereitet."
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{ title: string; text: string; badge?: string }>;
  ctaHref?: string;
  ctaLabel?: string;
  statusLabel?: string;
  statusDescription?: string;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.14),transparent_34%),linear-gradient(145deg,rgba(12,19,32,0.98),rgba(5,8,14,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-mist sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">{description}</p>
        <div className="mt-5 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-amber">
          <p className="font-semibold">{statusLabel}</p>
          <p className="mt-1 text-xs">{statusDescription}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={ctaHref} className="rounded-2xl bg-profit px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110">
            {ctaLabel}
          </Link>
          <Link href="/settings" className="rounded-2xl border border-stroke bg-panel px-4 py-3 text-sm font-semibold text-mist transition hover:border-cyan/40">
            Refresh & Datenqualität
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-mist">{card.title}</h2>
              {card.badge ? (
                <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">
                  {card.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{card.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
