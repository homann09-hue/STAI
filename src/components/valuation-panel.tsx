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
 * An echten Apple-Zahlen: Punktwert 182,10 $, Spanne 140–290 $.
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
