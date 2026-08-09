"use client";

import { useState } from "react";
import { AlertTriangle, BarChart3, Search } from "lucide-react";
import type { BacktestRefusal, BacktestResult } from "@/lib/analysis/backtest";
import { formatCurrency } from "@/lib/scoring";

/**
 * Backtest auf echter Historie.
 *
 * Der Unterschied zur Projektion darunter ist der ganze Punkt dieser
 * Komponente: hier gibt der Nutzer **keine Rendite ein**. Er gibt ein Symbol
 * ein, und was herauskommt, ist gemessen.
 */

type Response = {
  symbol: string;
  result: BacktestResult | BacktestRefusal;
  metadata: { provider: string | null; historyNote: string; planYears: number; plan: string };
};

type State =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; data: Response }
  | { status: "denied"; message: string }
  | { status: "failed"; message: string };

function Metric({
  label,
  value,
  tone = "text-mist",
  hint
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-muted">{hint}</p> : null}
    </div>
  );
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} %`;
}

export function BacktestRunner() {
  const [symbol, setSymbol] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [monthly, setMonthly] = useState("0");
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    setState({ status: "running" });

    try {
      const query = new URLSearchParams({ symbol: symbol.trim().toUpperCase(), capital, monthly });
      const response = await fetch(`/api/backtest?${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (response.status === 402 || response.status === 403) {
        setState({
          status: "denied",
          message:
            payload?.paywall?.message ??
            "Backtesting gehört zum Pro-Tarif. Der Zeitraum, den ein Backtest braucht, ist im kostenlosen Tarif nicht enthalten."
        });
        return;
      }

      if (!response.ok || !payload?.result) {
        setState({ status: "failed", message: payload?.error ?? "Der Backtest ist nicht durchgelaufen." });
        return;
      }

      setState({ status: "done", data: payload as Response });
    } catch {
      setState({ status: "failed", message: "Der Backtest ist nicht durchgelaufen." });
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-cyan" />
          <h2 className="text-lg font-semibold text-mist">Backtest auf echter Historie</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Hier wird keine Rendite angenommen. Der Sparplan läuft über die tatsächlichen Tagesschlusskurse
          des Symbols; gekauft wird am ersten Handelstag jedes Monats zum Schlusskurs.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="text-sm text-muted">
            Symbol
            <input
              value={symbol}
              maxLength={12}
              onChange={(event) => setSymbol(event.target.value.slice(0, 12))}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 font-mono uppercase text-mist outline-none focus:border-cyan"
            />
          </label>
          <label className="text-sm text-muted">
            Startkapital
            <input
              value={capital}
              inputMode="decimal"
              maxLength={12}
              onChange={(event) => setCapital(event.target.value.slice(0, 12))}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
          </label>
          <label className="text-sm text-muted">
            Monatlich
            <input
              value={monthly}
              inputMode="decimal"
              maxLength={12}
              onChange={(event) => setMonthly(event.target.value.slice(0, 12))}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={state.status === "running"}
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-5 font-semibold text-ink disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {state.status === "running" ? "Rechnet …" : "Backtest"}
          </button>
        </div>
      </div>

      {state.status === "denied" ? (
        <div className="rounded-[1.5rem] border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-amber">
          {state.message}
        </div>
      ) : null}

      {state.status === "failed" ? (
        <div className="rounded-[1.5rem] border border-loss/25 bg-loss/10 p-4 text-sm leading-6 text-loss">
          {state.message} Es werden bewusst keine Ersatzwerte gezeigt.
        </div>
      ) : null}

      {state.status === "done" && !state.data.result.ok ? (
        <div className="rounded-[1.5rem] border border-amber/30 bg-amber/10 p-4">
          <p className="text-sm font-semibold text-amber">Kein Backtest möglich</p>
          <p className="mt-1 text-sm leading-6 text-amber">{state.data.result.reason}</p>
          <p className="mt-3 text-xs leading-5 text-muted">{state.data.metadata.historyNote}</p>
        </div>
      ) : null}

      {state.status === "done" && state.data.result.ok ? (
        <BacktestReport data={state.data} result={state.data.result} />
      ) : null}
    </section>
  );
}

function BacktestReport({ data, result }: { data: Response; result: BacktestResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        <span className="font-mono text-mist">{data.symbol}</span> · {result.from} bis {result.to} ·{" "}
        {result.years.toFixed(1)} Jahre · {result.symbolPoints} Handelstage
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Eingezahlt" value={formatCurrency(result.invested, "EUR")} />
        <Metric
          label="Endwert"
          value={formatCurrency(result.finalValue, "EUR")}
          tone={result.profit >= 0 ? "text-profit" : "text-loss"}
        />
        <Metric
          label="Größter Rückgang"
          value={`${result.maxDrawdown.toFixed(1)} %`}
          tone="text-loss"
          hint={`${result.maxDrawdownFrom} bis ${result.maxDrawdownTo}`}
        />
        <Metric label="Volatilität p.a." value={`${result.volatility.toFixed(1)} %`} tone="text-amber" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label="Rendite der Strategie p.a."
          value={percent(result.timeWeightedCagr)}
          tone={result.timeWeightedCagr >= 0 ? "text-profit" : "text-loss"}
          hint="Zeitgewichtet — unabhängig davon, wann eingezahlt wurde. Damit vergleicht man Strategien."
        />
        <Metric
          label="Rendite dieses Sparplans p.a."
          value={result.moneyWeightedIrr === null ? "—" : percent(result.moneyWeightedIrr)}
          tone={(result.moneyWeightedIrr ?? 0) >= 0 ? "text-profit" : "text-loss"}
          hint="Geldgewichtet (interner Zinsfuß) — was mit diesem Einzahlungsplan tatsächlich herauskam."
        />
      </div>

      {result.bestYear && result.worstYear ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label={`Bestes Jahr (${result.bestYear.year})`}
            value={percent(result.bestYear.changePercent)}
            tone="text-profit"
          />
          <Metric
            label={`Schlechtestes Jahr (${result.worstYear.year})`}
            value={percent(result.worstYear.changePercent)}
            tone="text-loss"
          />
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-stroke bg-coal/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Was hier nicht drinsteckt</p>
        <ul className="mt-3 space-y-2">
          {result.caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2 text-xs leading-5 text-amber">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-4 text-muted">
          {data.metadata.historyNote} Tarif {data.metadata.plan}: {data.metadata.planYears} Jahre Historie.
        </p>
      </div>
    </div>
  );
}
