import { Activity, DatabaseZap, ShieldAlert } from "lucide-react";

import { formatGermanDateTime } from "@/lib/date-time";
import type { HistoricalRiskMetrics } from "@/lib/types";

function value(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

export function HistoricalRiskPanel({ metrics }: { metrics: HistoricalRiskMetrics }) {
  const entries = [
    ["Gesamtrendite", value(metrics.metrics.totalReturnPercent, " %")],
    ["Rendite p.a.", value(metrics.metrics.annualizedReturnPercent, " %")],
    ["Volatilität p.a.", value(metrics.metrics.annualizedVolatilityPercent, " %")],
    ["Downside-Volatilität", value(metrics.metrics.downsideVolatilityPercent, " %")],
    ["Max. Drawdown", value(metrics.metrics.maxDrawdownPercent, " %")],
    ["Sharpe Ratio", value(metrics.metrics.sharpeRatio)],
    ["Sortino Ratio", value(metrics.metrics.sortinoRatio)],
    ["Calmar Ratio", value(metrics.metrics.calmarRatio)],
    ["Historischer VaR 95 %", value(metrics.metrics.valueAtRisk95Percent, " %")],
    ["Historischer CVaR 95 %", value(metrics.metrics.conditionalValueAtRisk95Percent, " %")]
  ] as const;

  return (
    <section className="rounded-[1.4rem] border border-stroke bg-panel/80 p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan" />
            <h2 className="text-lg font-semibold">Historische Risiko- und Renditeanalyse</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Deterministische Berechnung aus verifizierten Schlusskursen. Keine Prognose und keine Verlustgarantie.
          </p>
        </div>
        <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${metrics.status === "available" ? "border-profit/30 bg-profit/10 text-profit" : "border-amber/30 bg-amber/10 text-amber"}`}>
          {metrics.status === "available" ? "Berechnet" : metrics.status === "insufficient_data" ? "Zu wenig Historie" : "Nicht verfügbar"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {entries.map(([label, metric]) => (
          <div key={label} className="rounded-2xl border border-stroke bg-ink/45 p-3">
            <p className="text-xs text-muted">{label}</p>
            <p className={`mt-2 font-mono text-lg font-semibold ${metric === "n/a" ? "text-muted" : "text-mist"}`}>{metric}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-panel2 p-3 text-xs leading-5 text-muted">
          <div className="flex items-center gap-2 text-mist">
            <DatabaseZap className="h-4 w-4 text-cyan" />
            <span className="font-semibold">Datenbasis</span>
          </div>
          <p className="mt-2">Quelle: {metrics.provider}</p>
          <p>Stand: {formatGermanDateTime(metrics.asOf, { dateStyle: "medium", timeStyle: "short" })}</p>
          <p>{metrics.sampleSize} Renditen, Mindestmenge {metrics.minimumReturns}, Annualisierung {metrics.tradingDays} Handelstage.</p>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="font-semibold">Annahmen und Grenzen</span>
          </div>
          {metrics.warnings.map((warning) => <p key={warning} className="mt-2">{warning}</p>)}
        </div>
      </div>
    </section>
  );
}
