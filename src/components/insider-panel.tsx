import { ExternalLink, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { insiderRole, type InsiderSummary, type InsiderTransaction } from "@/lib/sec/form4";
import type { SecFiling } from "@/lib/sec/edgar";

/**
 * Insidertransaktionen und Filings.
 *
 * §32 verlangt die Unterscheidung echter Käufe von Vergütung, Optionsausübung
 * und automatischen Programmen. Die Anzeige macht sie sichtbar, statt sie in
 * einer Summe verschwinden zu lassen: **jede Zeile trägt ihren
 * Transaktionscode mit.**
 *
 * Der Grund steht in den echten Daten. Apple, 2026-06-15: eine Insiderin
 * „erwarb" 30.104 Aktien — Code `M`, also eine Optionsausübung. Gekauft hat
 * niemand.
 */

const kindTone: Record<string, string> = {
  open_market_buy: "border-profit/30 bg-profit/10 text-profit",
  open_market_sell: "border-loss/30 bg-loss/10 text-loss",
  compensation: "border-stroke bg-panel2 text-muted",
  option_exercise: "border-stroke bg-panel2 text-muted",
  tax_withholding: "border-stroke bg-panel2 text-muted",
  gift_or_inheritance: "border-stroke bg-panel2 text-muted",
  other: "border-stroke bg-panel2 text-muted"
};

function formatShares(value: number | null) {
  return value === null ? "—" : value.toLocaleString("de-DE");
}

export function InsiderPanel({
  transactions,
  summary,
  currency
}: {
  transactions: InsiderTransaction[];
  summary: InsiderSummary;
  currency: string;
}) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex items-center gap-2">
        <UserRound className="h-5 w-5 text-cyan" />
        <h2 className="text-lg font-semibold">Insidertransaktionen</h2>
      </div>

      {/* Die Einordnung steht vor den Zahlen. Wer zuerst eine Summe sieht,
          liest sie als Signal -- auch wenn sie keines ist. */}
      <p className="mt-3 rounded-2xl border border-cyan/20 bg-cyan/10 p-3 text-sm leading-6 text-muted">
        {summary.interpretation}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Käufe über den Markt"
          value={`${summary.openMarketBuys}`}
          detail={summary.buyValue > 0 ? `${Math.round(summary.buyValue).toLocaleString("de-DE")} ${currency}` : "—"}
          tone={summary.openMarketBuys > 0 ? "text-profit" : "text-muted"}
        />
        <Tile
          label="Verkäufe über den Markt"
          value={`${summary.openMarketSells}`}
          detail={summary.sellValue > 0 ? `${Math.round(summary.sellValue).toLocaleString("de-DE")} ${currency}` : "—"}
          tone={summary.openMarketSells > 0 ? "text-loss" : "text-muted"}
        />
        <Tile
          label="Zuteilung / Steuer"
          value={`${summary.compensationCount}`}
          detail="keine Marktentscheidung"
          tone="text-muted"
        />
        <Tile
          label="Optionsausübung"
          value={`${summary.optionExerciseCount}`}
          detail={`${summary.plannedMarketCount} Marktgeschäfte aus 10b5-1-Plänen`}
          tone="text-muted"
        />
      </div>

      {transactions.length ? (
        <div className="mt-4 space-y-2">
          {transactions.slice(0, 12).map((transaction, index) => (
            <article
              key={`${transaction.person}-${transaction.date}-${transaction.code}-${index}`}
              className="rounded-2xl border border-stroke bg-coal/55 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-mist">{transaction.person}</p>
                <p className="text-xs text-muted">{transaction.date}</p>
              </div>
              <p className="mt-1 text-xs text-muted">{insiderRole(transaction)}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {/* Der Code steht sichtbar dabei -- ohne ihn liesse sich die
                    Einordnung nicht nachpruefen. */}
                <span className={`rounded-md border px-2 py-1 ${kindTone[transaction.kind] ?? kindTone.other}`}>
                  {transaction.code} · {transaction.codeLabel}
                </span>
                {transaction.isPlanned ? (
                  <span className="rounded-md border border-stroke bg-panel2 px-2 py-1 text-muted">
                    Rule 10b5-1 — Monate vorher terminiert
                  </span>
                ) : null}
              </div>

              <p className="mt-2 font-mono text-sm text-mist">
                {transaction.direction === "acquired" ? "+" : "−"}
                {formatShares(transaction.shares)} Stück
                {transaction.pricePerShare !== null
                  ? ` zu ${transaction.pricePerShare.toFixed(2)} ${currency}`
                  : " (kein Preis gemeldet)"}
                {transaction.value !== null
                  ? ` · ${Math.round(transaction.value).toLocaleString("de-DE")} ${currency}`
                  : ""}
              </p>
              {transaction.sharesOwnedAfter !== null ? (
                <p className="mt-1 text-[11px] text-muted">
                  Bestand danach: {formatShares(transaction.sharesOwnedAfter)} Stück
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Keine gemeldeten Transaktionen im betrachteten Zeitraum.</p>
      )}

      <p className="mt-4 text-[11px] leading-4 text-muted">
        Quelle: Formular 4 der U.S. Securities and Exchange Commission. Nur Code <strong>P</strong> ist ein
        Kauf über den Markt — nur dort hat jemand eigenes Geld zum Marktpreis eingesetzt.
      </p>
    </section>
  );
}

function Tile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

/**
 * §31: Filings mit Link auf das Originaldokument.
 *
 * Der Link führt unverändert zur Behörde. Eine Zwischenseite mit eigener
 * Aufbereitung wäre bequemer und würde genau die Eigenschaft aufgeben, die
 * diese Quelle wertvoll macht.
 */
export function FilingsPanel({ filings, companyName }: { filings: SecFiling[]; companyName: string }) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-cyan" />
        <h2 className="text-lg font-semibold">Einreichungen bei der SEC</h2>
      </div>
      <p className="mt-1 text-xs text-muted">{companyName}</p>

      {filings.length ? (
        <div className="mt-3 space-y-2">
          {filings.slice(0, 15).map((filing) => (
            <div key={filing.accessionNumber} className="rounded-2xl border border-stroke bg-coal/55 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-mist">{filing.form}</p>
                <p className="text-xs text-muted">
                  eingereicht {filing.filedAt}
                  {filing.reportDate ? ` · Stichtag ${filing.reportDate}` : ""}
                </p>
              </div>
              {filing.formExplanation ? (
                <p className="mt-1 text-[11px] leading-4 text-muted">{filing.formExplanation}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Link
                  className="inline-flex items-center gap-1 rounded-md bg-panel2 px-2 py-1 text-cyan"
                  href={filing.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Originaldokument <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  className="rounded-md bg-panel2 px-2 py-1 text-muted"
                  href={filing.indexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Alle Anlagen
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Kein Eintrag im SEC-Register. Die Behörde erfasst nur US-Emittenten.
        </p>
      )}
    </section>
  );
}
