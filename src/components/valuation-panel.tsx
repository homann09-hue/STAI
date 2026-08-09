import { Calculator, Scale, TrendingUp } from "lucide-react";
import {
  formatValuationRange,
  type DcfResult,
  type PeerComparison,
  type SensitivityAnalysis,
  type YieldValuation
} from "@/lib/analysis/valuation";

/**
 * Anzeige der Bewertung.
 *
 * Die Gestaltung folgt §38: **die Spanne ist die Überschrift, der Punktwert
 * eine Fußnote.** Umgekehrt wäre bequemer und unehrlich — eine große Zahl mit
 * zwei Nachkommastellen liest sich wie ein Kursziel, obwohl sie aus Annahmen
 * entsteht, die um Prozentpunkte danebenliegen können.
 *
 * An echten Apple-Zahlen: Punktwert 128,77 $, Spanne 88–240 $.
 *
 * (Die Zahlen standen hier zunächst als 182,10 $ und 140–290 $ — gerechnet mit
 * einer Nettoverschuldung, die aus `enterpriseValue − marketCap` abgeleitet war
 * und deshalb zwei verschiedene Stichtage vermischte. Sie kommt jetzt aus der
 * Bilanz.)
 */
export function ValuationPanel({
  dcf,
  sensitivity,
  impliedGrowth,
  yields,
  currency
}: {
  dcf: DcfResult;
  sensitivity: SensitivityAnalysis;
  impliedGrowth: { growthRate: number; note: string } | null;
  yields: YieldValuation;
  currency: string;
}) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-cyan" />
        <h2 className="text-lg font-semibold">Bewertung</h2>
      </div>

      {!dcf.ok ? (
        <p className="mt-3 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-amber">
          {dcf.reason}
        </p>
      ) : (
        <>
          {/* Die Spanne steht gross und zuerst. Der Punktwert klein darunter. */}
          <div className="mt-4 rounded-2xl border border-cyan/25 bg-cyan/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan">Wertspanne aus der Sensitivität</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-mist sm:text-3xl">
              {formatValuationRange(sensitivity.range, currency)}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Rechnerischer Einzelwert {dcf.fairValuePerShare.toFixed(2)} {currency} — bewusst klein
              dargestellt. Er entsteht aus Annahmen, die um Prozentpunkte danebenliegen können, und wäre als
              Kursziel gelesen eine Scheingenauigkeit.
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Fact
              label="Annahmen"
              value={`${(dcf.assumptions.growthRate * 100).toFixed(1)} % Wachstum · ${(dcf.assumptions.discountRate * 100).toFixed(1)} % Diskont · ${(dcf.assumptions.terminalGrowth * 100).toFixed(1)} % ewig · ${dcf.assumptions.years} Jahre`}
            />
            <Fact
              label="Anteil des Endwerts"
              value={`${(dcf.terminalShare * 100).toFixed(0)} % des Werts liegt nach Jahr ${dcf.assumptions.years}`}
            />
          </div>

          {dcf.caveats.length ? (
            <ul className="mt-3 space-y-2">
              {dcf.caveats.map((caveat) => (
                <li
                  key={caveat}
                  className="rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber"
                >
                  {caveat}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3 text-[11px] leading-4 text-muted">{sensitivity.note}</p>
        </>
      )}

      {impliedGrowth ? (
        <div className="mt-4 rounded-2xl border border-stroke bg-coal/55 p-4">
          <div className="flex items-center gap-2 text-muted">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Was der Kurs voraussetzt</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{impliedGrowth.note}</p>
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-stroke bg-coal/55 p-4">
        <div className="flex items-center gap-2 text-muted">
          <Scale className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Renditevergleich</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">{yields.interpretation}</p>
      </div>

      <p className="mt-4 text-[11px] leading-4 text-muted">
        Modellrechnung auf Basis der angegebenen Annahmen. Keine Anlageberatung und kein Kursziel.
      </p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-sm text-mist">{value}</p>
    </div>
  );
}

/**
 * Die Kursziele im Verlauf, gegen den aktuellen Kurs.
 *
 * §33 verlangt ausdrücklich, zeitliche Veränderungen **darzustellen**. Drei
 * Zahlen nebeneinander sind noch keine Darstellung — erst die gemeinsame Skala
 * zeigt, dass die Ziele mit dem Kurs gestiegen sind statt ihn vorwegzunehmen.
 *
 * Der aktuelle Kurs ist als Linie eingezeichnet, weil er die einzige Größe ist,
 * gegen die ein Kursziel überhaupt eine Aussage hat.
 */
function TargetTrend({
  targets,
  price,
  currency
}: {
  targets: Array<[string, number | null, number]>;
  price: number | null;
  currency: string;
}) {
  const values = targets.map(([, value]) => value).filter((value): value is number => value !== null);
  if (values.length < 2 || price === null || price <= 0) return null;

  // Gemeinsame Skala ueber Ziele und Kurs, mit etwas Luft an beiden Enden.
  const min = Math.min(...values, price) * 0.96;
  const max = Math.max(...values, price) * 1.04;
  const position = (value: number) => ((value - min) / (max - min)) * 100;

  return (
    <div className="mt-3 rounded-2xl border border-stroke bg-coal/55 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Kursziele im Verlauf</p>

      <div className="relative mt-4 space-y-3">
        {targets.map(([label, value, count]) =>
          value === null ? null : (
            <div key={label} className="relative">
              <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted">
                <span>{label}</span>
                <span className="font-mono text-mist">
                  {value.toFixed(2)} {currency} · {count} Häuser
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel2">
                <div
                  className={`h-full rounded-full ${value >= price ? "bg-profit/60" : "bg-loss/60"}`}
                  style={{ width: `${Math.max(2, Math.min(100, position(value)))}%` }}
                />
              </div>
            </div>
          )
        )}

        {/* Der aktuelle Kurs als Bezugslinie. */}
        <div className="relative pt-1">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-cyan">Aktueller Kurs</span>
            <span className="font-mono text-cyan">
              {price.toFixed(2)} {currency}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-cyan/70"
              style={{ width: `${Math.max(2, Math.min(100, position(price)))}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-muted">
        Gemeinsame Skala. Ein Kursziel über dem Kurs ist keine Prognose, sondern die Einschätzung eines
        Hauses — und sie folgt dem Kurs häufiger, als sie ihn vorwegnimmt.
      </p>
    </div>
  );
}

/**
 * Analystenurteile und Kursziele (§33).
 *
 * Die Zeiträume stehen **nebeneinander** statt zu einem Wert verrechnet. Die
 * Bewegung ist die Information: bei Apple lag das Durchschnittsziel des letzten
 * Monats bei 329,55 $, das des letzten Jahres bei 306,68 $. Ein Mittelwert
 * hätte genau das gelöscht.
 */
export function AnalystPanel({
  view,
  currency,
  price = null
}: {
  view: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    consensus: string | null;
    targets: { lastMonth: number | null; lastQuarter: number | null; lastYear: number | null };
    counts: { lastMonth: number; lastQuarter: number; lastYear: number };
    note: string;
  };
  currency: string;
  /** Der aktuelle Kurs. Ohne ihn hat ein Kursziel keine Bezugsgröße. */
  price?: number | null;
}) {
  const ratings: Array<[string, number, string]> = [
    ["Strong Buy", view.strongBuy, "text-profit"],
    ["Buy", view.buy, "text-profit"],
    ["Hold", view.hold, "text-amber"],
    ["Sell", view.sell, "text-loss"],
    ["Strong Sell", view.strongSell, "text-loss"]
  ];
  const total = ratings.reduce((sum, [, count]) => sum + count, 0);

  const targets: Array<[string, number | null, number]> = [
    ["Letzter Monat", view.targets.lastMonth, view.counts.lastMonth],
    ["Letztes Quartal", view.targets.lastQuarter, view.counts.lastQuarter],
    ["Letztes Jahr", view.targets.lastYear, view.counts.lastYear]
  ];

  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Analystenurteile</h2>
        {view.consensus ? <span className="text-sm text-muted">Konsens: {view.consensus}</span> : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {ratings.map(([label, count, tone]) => (
          <div key={label} className="rounded-2xl border border-stroke bg-coal/55 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className={`mt-1 font-mono text-lg font-semibold ${count > 0 ? tone : "text-muted"}`}>{count}</p>
            <p className="mt-1 text-[11px] text-muted">
              {total > 0 ? `${Math.round((count / total) * 100)} %` : "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {targets.map(([label, value, count]) => (
          <div key={label} className="rounded-2xl border border-stroke bg-coal/55 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-mist">
              {value === null ? "—" : `${value.toFixed(2)} ${currency}`}
            </p>
            <p className="mt-1 text-[11px] text-muted">{count} Häuser</p>
          </div>
        ))}
      </div>

      <TargetTrend targets={targets} price={price} currency={currency} />

      <p className="mt-3 text-[11px] leading-4 text-muted">{view.note}</p>
    </section>
  );
}

export function PeerComparisonPanel({ comparisons }: { comparisons: PeerComparison[] }) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <h2 className="text-lg font-semibold">Vergleich mit Wettbewerbern</h2>
      <div className="mt-3 space-y-2">
        {comparisons.map((comparison) => (
          <div key={comparison.metric} className="rounded-2xl border border-stroke bg-coal/55 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-mist">{comparison.metric}</p>
              <p className="font-mono text-sm text-mist">
                {comparison.own === null ? "—" : comparison.own.toFixed(1)}
                {comparison.median !== null ? (
                  <span className="text-muted"> · Median {comparison.median.toFixed(1)}</span>
                ) : null}
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted">{comparison.interpretation}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-muted">
        Median statt Mittelwert: ein einzelnes Unternehmen mit extremer Bewertung würde den Durchschnitt der
        Gruppe unbrauchbar machen.
      </p>
    </section>
  );
}
