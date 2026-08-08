"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Clock, ExternalLink } from "lucide-react";
import type { MacroFreshness, MacroOverview, MacroReading, MacroTrend } from "@/lib/macro/analysis";

/**
 * Die Makroansicht.
 *
 * Der Wert dieser Seite liegt nicht in den fünf Zahlen — die stehen auch auf der
 * Website der EZB. Er liegt darin, dass neben jeder Zahl steht, von wann sie
 * ist, was sie bedeutet und ob man aus ihr etwas ableiten darf. Genau das muss
 * ein Nutzer sonst selbst zusammensuchen.
 *
 * Deshalb ist das Datenalter hier kein Kleingedrucktes, sondern gleichrangig
 * mit dem Wert dargestellt.
 */

type LoadState =
  | { status: "loading" }
  | { status: "ready"; overview: MacroOverview }
  | { status: "failed"; message: string };

const freshnessTone: Record<MacroFreshness, { label: string; className: string }> = {
  current: { label: "aktuell", className: "border-profit/30 bg-profit/10 text-profit" },
  delayed: { label: "verzögert", className: "border-amber/30 bg-amber/10 text-amber" },
  outdated: { label: "veraltet", className: "border-loss/30 bg-loss/10 text-loss" }
};

const trendIcon: Record<MacroTrend, typeof ArrowRight> = {
  rising: ArrowUpRight,
  falling: ArrowDownRight,
  flat: ArrowRight,
  unknown: ArrowRight
};

function formatValue(reading: MacroReading) {
  const digits = reading.unit === "percent" ? 2 : 4;
  const formatted = reading.value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return reading.unit === "percent" ? `${formatted} %` : formatted;
}

function formatChange(reading: MacroReading) {
  if (reading.change === null) return null;
  const digits = reading.unit === "percent" ? 2 : 4;
  const sign = reading.change > 0 ? "+" : "";
  const value = reading.change.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return reading.unit === "percent" ? `${sign}${value} Prozentpunkte` : `${sign}${value}`;
}

function ReadingCard({ reading }: { reading: MacroReading }) {
  const tone = freshnessTone[reading.freshness];
  const TrendIcon = trendIcon[reading.trend];
  const change = formatChange(reading);

  return (
    <article className="rounded-3xl border border-stroke bg-panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-mist">{reading.label}</h3>
        <span className={`rounded-xl border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.className}`}>
          {tone.label}
        </span>
      </header>

      <p className="mt-3 text-2xl font-semibold text-mist">{formatValue(reading)}</p>

      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {change ? (
          <span>{change} gegenüber der Vorperiode</span>
        ) : (
          <span>Keine Veränderung ableitbar</span>
        )}
      </p>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Stand {reading.period} · {reading.ageDays === 0 ? "heute" : `${reading.ageDays} Tage alt`}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-muted">{reading.explanation}</p>

      {reading.caveats.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {reading.caveats.map((caveat) => (
            <li key={caveat} className="flex gap-1.5 text-xs text-amber">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function MacroOverviewView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let disposed = false;

    fetch("/api/macro", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as MacroOverview | null;
        if (disposed) return;

        if (!response.ok || !payload || !Array.isArray(payload.readings)) {
          setState({
            status: "failed",
            message: "Die Makrodaten sind gerade nicht erreichbar. Es werden bewusst keine Ersatzwerte gezeigt."
          });
          return;
        }

        setState({ status: "ready", overview: payload });
      })
      .catch(() => {
        if (!disposed) {
          setState({
            status: "failed",
            message: "Die Makrodaten sind gerade nicht erreichbar. Es werden bewusst keine Ersatzwerte gezeigt."
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-3xl border border-stroke bg-panel p-5" aria-busy="true">
        <p className="text-sm text-muted">Makrodaten werden geladen …</p>
      </section>
    );
  }

  if (state.status === "failed") {
    return (
      <section className="rounded-3xl border border-loss/25 bg-loss/10 p-5">
        <h2 className="text-lg font-semibold text-mist">Makrodaten nicht verfügbar</h2>
        <p className="mt-1 text-sm text-loss">{state.message}</p>
      </section>
    );
  }

  const { overview } = state;
  const curve = overview.yieldCurve;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Makrolage Euroraum</p>
        <h1 className="mt-1 text-lg font-semibold text-mist">Zinsen, Inflation und Wechselkurs mit Stichtag</h1>
        <p className="mt-1 text-sm text-muted">
          Jede Zahl trägt ihren eigenen Stand. Ein Wert von gestern und einer von vor einem halben Jahr
          stehen hier nicht nebeneinander, als wären sie gleich aktuell.
        </p>
      </header>

      {!overview.reportable ? (
        <section className="rounded-3xl border border-amber/25 bg-amber/10 p-5">
          <p className="text-sm text-amber">
            Es liegen zu wenige Reihen vor, um die Makrolage zu beschreiben. Einzelne Werte sagen für sich
            genommen wenig aus.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Zinsstruktur</h2>
        {curve.available ? (
          <>
            <p className="mt-2 text-2xl font-semibold text-mist">
              {curve.shape === "normal" ? "Normal" : curve.shape === "inverted" ? "Invers" : "Flach"}
              {curve.spread !== null ? (
                <span className="ml-2 text-sm font-normal text-muted">
                  {curve.spread.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  Prozentpunkte zwischen 10 Jahren und 3 Monaten
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{curve.interpretation}</p>
            {curve.asOf ? <p className="mt-2 text-xs text-muted">Stand {curve.asOf}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-amber">{curve.interpretation}</p>
        )}

        {curve.caveats.length > 0 && curve.available ? (
          <ul className="mt-3 space-y-1">
            {curve.caveats.map((caveat) => (
              <li key={caveat} className="flex gap-1.5 text-xs text-amber">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{caveat}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {overview.policyRate ? (
        <section className="rounded-3xl border border-stroke bg-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Zinsentscheidungen der EZB</h2>
          <p className="mt-2 text-sm leading-relaxed text-mist">{overview.policyRate.summary}</p>

          {overview.policyRate.changes.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {overview.policyRate.changes.map((change) => (
                <li
                  key={change.effectiveFrom}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-stroke bg-coal px-3 py-2"
                >
                  <span className="font-mono text-xs text-muted">{change.effectiveFrom}</span>
                  <span
                    className={`text-sm font-semibold ${change.direction === "hike" ? "text-loss" : "text-profit"}`}
                  >
                    {change.direction === "hike" ? "Anhebung" : "Senkung"} um{" "}
                    {Math.abs(change.deltaPercentagePoints).toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{" "}
                    Prozentpunkte
                  </span>
                  <span className="text-xs text-muted">
                    {change.previousRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {" % → "}
                    {change.newRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="mt-4 space-y-1">
            {overview.policyRate.notes.map((note) => (
              <li key={note} className="text-xs leading-relaxed text-muted">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {overview.readings.map((reading) => (
          <ReadingCard key={reading.id} reading={reading} />
        ))}
      </div>

      {overview.unavailableSeries.length > 0 ? (
        <section className="rounded-3xl border border-stroke bg-coal p-5">
          <h2 className="text-sm font-semibold text-mist">Nicht geladene Reihen</h2>
          <p className="mt-1 text-xs text-muted">
            {overview.unavailableSeries.length} von{" "}
            {overview.readings.length + overview.unavailableSeries.length} Reihen konnten nicht abgerufen
            werden. Sie fehlen hier, statt durch einen Ersatzwert ersetzt zu werden.
          </p>
        </section>
      ) : null}

      <footer className="rounded-3xl border border-stroke bg-coal p-5">
        <p className="text-xs leading-relaxed text-muted">{overview.disclaimer}</p>
        <a
          href="https://data.ecb.europa.eu"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan underline-offset-2 hover:underline"
        >
          Quelle: Europäische Zentralbank, EZB Data Portal
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
