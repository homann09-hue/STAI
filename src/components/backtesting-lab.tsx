"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Play, Save } from "lucide-react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import { formatCurrency, formatPercent, legalDisclaimer } from "@/lib/scoring";

type SavedBacktest = {
  id: string;
  strategy: string;
  capital: number;
  monthlyContribution: number;
  expectedReturn: number;
  volatility: number;
  years: number;
  createdAt: string;
};

const MAX_SAVED_BACKTESTS = 12;
const MAX_NUMERIC_INPUT_LENGTH = 24;
const MAX_STRATEGY_LENGTH = 80;

function toNumber(value: string, fallback: number) {
  const parsed = Number(value.slice(0, MAX_NUMERIC_INPUT_LENGTH).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cleanText(value: unknown, maxLength: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[<>\u0000-\u001F\u007F]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || fallback;
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function normalizeSavedBacktests(value: unknown): SavedBacktest[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_SAVED_BACKTESTS)
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<SavedBacktest>;

      return {
        id: cleanText(candidate.id, 120, `bt-${index}`),
        strategy: cleanText(candidate.strategy, MAX_STRATEGY_LENGTH, "Unbenannte Strategie"),
        capital: cleanNumber(candidate.capital, 1000, 0, 1_000_000_000),
        monthlyContribution: cleanNumber(candidate.monthlyContribution, 100, 0, 10_000_000),
        expectedReturn: cleanNumber(candidate.expectedReturn, 7, -80, 80),
        volatility: cleanNumber(candidate.volatility, 16, 0, 120),
        years: cleanNumber(candidate.years, 10, 1, 50),
        createdAt: cleanDate(candidate.createdAt)
      };
    })
    .filter((item): item is SavedBacktest => Boolean(item));
}

function safeCurveWidth(value: number, finalValue: number) {
  if (!Number.isFinite(value) || !Number.isFinite(finalValue) || finalValue <= 0) return 0;
  return clamp((value / finalValue) * 100, 0, 100);
}

export function BacktestingLab() {
  const [strategy, setStrategy] = useState("ETF Core + Qualitätsaktien");
  const [capital, setCapital] = useState("1000");
  const [monthlyContribution, setMonthlyContribution] = useState("100");
  const [expectedReturn, setExpectedReturn] = useState("7");
  const [volatility, setVolatility] = useState("16");
  const [years, setYears] = useState("10");
  const [saved, setSaved] = useState<SavedBacktest[]>([]);

  useEffect(() => {
    setSaved(normalizeSavedBacktests(readOfflineValue<unknown>(OFFLINE_KEYS.backtests)));
  }, []);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.backtests, saved);
  }, [saved]);

  const model = useMemo(() => {
    const start = Math.max(0, toNumber(capital, 1000));
    const monthly = Math.max(0, toNumber(monthlyContribution, 100));
    const annualReturn = clamp(toNumber(expectedReturn, 7), -80, 80) / 100;
    const annualVolatility = clamp(toNumber(volatility, 16), 0, 120) / 100;
    const durationYears = clamp(toNumber(years, 10), 1, 50);
    const months = durationYears * 12;
    const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
    let value = start;
    let contributions = start;
    const curve: Array<{ year: number; value: number; bear: number; bull: number }> = [];

    for (let month = 1; month <= months; month += 1) {
      value = value * (1 + monthlyReturn) + monthly;
      contributions += monthly;
      if (month % 12 === 0) {
        const year = month / 12;
        const stress = annualVolatility * Math.sqrt(year) * 0.62;
        curve.push({
          year,
          value,
          bear: value * Math.max(0.05, 1 - stress),
          bull: value * (1 + stress)
        });
      }
    }

    const finalValue = curve[curve.length - 1]?.value ?? value;
    const estimatedDrawdown = clamp(annualVolatility * 1.8 * 100, 4, 75);
    const sharpeLike = annualVolatility ? annualReturn / annualVolatility : 0;
    const lossScenario = finalValue * (1 - estimatedDrawdown / 100);

    return {
      start,
      monthly,
      annualReturn,
      annualVolatility,
      durationYears,
      contributions,
      finalValue,
      profit: finalValue - contributions,
      estimatedDrawdown,
      sharpeLike,
      lossScenario,
      curve
    };
  }, [capital, expectedReturn, monthlyContribution, volatility, years]);

  function saveScenario() {
    const next: SavedBacktest = {
      id: `bt-${Date.now()}`,
      strategy: cleanText(strategy, MAX_STRATEGY_LENGTH, "Unbenannte Strategie"),
      capital: model.start,
      monthlyContribution: model.monthly,
      expectedReturn: model.annualReturn * 100,
      volatility: model.annualVolatility * 100,
      years: model.durationYears,
      createdAt: new Date().toISOString()
    };
    setSaved((current) => [next, ...current].slice(0, MAX_SAVED_BACKTESTS));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.14),transparent_34%),linear-gradient(145deg,rgba(12,19,32,0.98),rgba(5,8,14,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">Backtesting MVP</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-mist sm:text-4xl">
          Strategien lokal simulieren, Risiken sehen, Annahmen speichern
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Dieses Modul ist sofort nutzbar als Szenario-Backtest. Es ersetzt keine historischen,
          adjustierten Tick-/Candle-Daten, markiert aber Rendite, Volatilität und Drawdown transparent als Modellannahmen.
        </p>
        <p className="mt-4 rounded-2xl border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-amber">{legalDisclaimer}</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
          <h2 className="text-lg font-semibold text-mist">Strategie-Annahmen</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-muted">
              Strategie
              <input value={strategy} maxLength={MAX_STRATEGY_LENGTH} onChange={(event) => setStrategy(event.target.value.slice(0, MAX_STRATEGY_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <label className="text-sm text-muted">
              Startkapital
              <input value={capital} inputMode="decimal" maxLength={MAX_NUMERIC_INPUT_LENGTH} onChange={(event) => setCapital(event.target.value.slice(0, MAX_NUMERIC_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <label className="text-sm text-muted">
              Monatliche Einzahlung
              <input value={monthlyContribution} inputMode="decimal" maxLength={MAX_NUMERIC_INPUT_LENGTH} onChange={(event) => setMonthlyContribution(event.target.value.slice(0, MAX_NUMERIC_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-muted">
                Rendite p.a. %
                <input value={expectedReturn} inputMode="decimal" maxLength={MAX_NUMERIC_INPUT_LENGTH} onChange={(event) => setExpectedReturn(event.target.value.slice(0, MAX_NUMERIC_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
              </label>
              <label className="text-sm text-muted">
                Volatilität %
                <input value={volatility} inputMode="decimal" maxLength={MAX_NUMERIC_INPUT_LENGTH} onChange={(event) => setVolatility(event.target.value.slice(0, MAX_NUMERIC_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
              </label>
              <label className="text-sm text-muted">
                Jahre
                <input value={years} inputMode="numeric" maxLength={MAX_NUMERIC_INPUT_LENGTH} onChange={(event) => setYears(event.target.value.slice(0, MAX_NUMERIC_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
              </label>
            </div>
            <button type="button" onClick={saveScenario} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-profit px-4 font-semibold text-ink">
              <Save className="h-4 w-4" />
              Szenario speichern
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
              <p className="text-xs text-muted">Endwert Modell</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-mist">{formatCurrency(model.finalValue, "EUR")}</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
              <p className="text-xs text-muted">Gewinn Modell</p>
              <p className={`mt-2 font-mono text-2xl font-semibold ${model.profit >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(model.profit, "EUR")}</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
              <p className="text-xs text-muted">Max Drawdown Schätzung</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-amber">{model.estimatedDrawdown.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
              <p className="text-xs text-muted">Rendite/Risiko</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">{model.sharpeLike.toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan" />
              <h2 className="text-lg font-semibold text-mist">Jahreskurve</h2>
            </div>
            <div className="mt-4 space-y-2">
              {model.curve.map((point) => (
                <div key={point.year}>
                  <div className="flex justify-between text-xs text-muted">
                    <span>Jahr {point.year}</span>
                    <span>{formatCurrency(point.value, "EUR")}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-coal">
                    <div className="h-full rounded-full bg-cyan" style={{ width: `${safeCurveWidth(point.value, model.finalValue)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-loss/25 bg-loss/10 p-3 text-xs leading-5 text-loss">
              Stressfall bei geschätztem Drawdown: {formatCurrency(model.lossScenario, "EUR")}.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-profit" />
          <h2 className="text-lg font-semibold text-mist">Gespeicherte Szenarien</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {saved.length ? saved.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-mist">{item.strategy}</p>
              <p className="mt-2 text-xs text-muted">
                {formatCurrency(item.capital, "EUR")} Start, {formatCurrency(item.monthlyContribution, "EUR")} mtl.,
                {formatPercent(item.expectedReturn)} Rendite, {item.years} Jahre.
              </p>
            </article>
          )) : (
            <p className="rounded-2xl border border-stroke bg-coal/70 p-4 text-sm text-muted">
              Noch kein Szenario gespeichert. Nutze das Formular, um ein Backtest-Modell lokal abzulegen.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
