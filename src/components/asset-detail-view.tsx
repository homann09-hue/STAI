"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  AnalysisLayersPanel,
  DataQualityPanel,
  ProbabilityPanel,
  ProfessionalScoresPanel,
  RiskEnginePanel
} from "@/components/analysis-panels";
import {
  Activity,
  BarChart3,
  Brain,
  CalendarDays,
  DatabaseZap,
  FileSearch,
  Gauge,
  Layers3,
  Maximize2,
  Minimize2,
  ShieldAlert,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { CandlestickChart, PriceLineChart, ScoreMeter } from "@/components/charts";
import { AssetDecisionPanel } from "@/components/asset-decision-panel";
import { MarketDataStatus } from "@/components/market-data-status";
import { NewsList } from "@/components/news-list";
import { TechnicalTrendPanel } from "@/components/technical-trend-panel";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import {
  formatCompact,
  formatCurrency,
  formatPercent,
  legalDisclaimer,
  riskTone,
  scoreLabel,
  scoreTone
} from "@/lib/scoring";
import { buildAssetReadiness, buildFundamentalMetrics } from "@/lib/asset-readiness";
import { buildAssetProvenancePassport, type AssetProvenanceEntry } from "@/lib/asset-provenance";
import { buildForecastPassport, type ForecastPassport } from "@/lib/forecast-passport";
import { useMarketStream } from "@/lib/use-market-stream";
import { AnalystPanel, PeerComparisonPanel, ValuationPanel } from "@/components/valuation-panel";
import { FilingsPanel, InsiderPanel } from "@/components/insider-panel";
import { CorporateActionsPanel } from "@/components/corporate-actions-panel";
import type { CorporateActionsResult } from "@/lib/corporate-actions";
import type { CompanyFilings } from "@/lib/sec/edgar";
import type { InsiderSummary, InsiderTransaction } from "@/lib/sec/form4";
import { MetricGrid } from "@/components/metric-with-context";
import type { ValuationView } from "@/lib/analysis/valuation-view";
import type { AssetDetail, Candle, Quote, TimeRange } from "@/lib/types";
import { timeRanges } from "@/lib/types";

const CHART_PREFS_KEY = "stockpilot:chart-preferences";

type ChartPreferences = {
  range: TimeRange;
  showSma: boolean;
  showVolume: boolean;
  showBenchmark: boolean;
};

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 font-mono text-lg font-semibold ${tone ?? "text-mist"}`}>{value}</p>
    </div>
  );
}

function readinessTone(status: ReturnType<typeof buildAssetReadiness>["status"]) {
  if (status === "ready") return "border-profit/30 bg-profit/10 text-profit";
  if (status === "limited") return "border-amber/30 bg-amber/10 text-amber";
  return "border-loss/35 bg-loss/10 text-loss";
}

function qualityTone(available: boolean) {
  return available ? "border-profit/25 bg-profit/10 text-profit" : "border-amber/25 bg-amber/10 text-amber";
}

function provenanceStatusTone(status: AssetProvenanceEntry["status"]) {
  if (status === "fresh") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "delayed") return "border-amber/25 bg-amber/10 text-amber";
  if (status === "stale") return "border-loss/25 bg-loss/10 text-loss";
  if (status === "mock") return "border-cyan/25 bg-cyan/10 text-cyan";
  if (status === "blocked") return "border-loss/30 bg-loss/10 text-loss";
  return "border-stroke bg-coal text-muted";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUsableCandle(candle: Candle) {
  return (
    isFiniteNumber(candle.open) &&
    isFiniteNumber(candle.high) &&
    isFiniteNumber(candle.low) &&
    isFiniteNumber(candle.close) &&
    candle.high >= candle.low &&
    candle.close > 0
  );
}

function formatMaybeCurrency(value: number | null | undefined, currency: string) {
  return isFiniteNumber(value) ? formatCurrency(value, currency) : "n/a";
}

function formatMaybeNumber(value: number | null | undefined, digits = 2) {
  return isFiniteNumber(value) ? value.toFixed(digits) : "n/a";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("de-DE") : "nicht verfügbar";
}

function AssetProvenancePanel({ passport }: { passport: ReturnType<typeof buildAssetProvenancePassport> }) {
  return (
    <section className="rounded-[1.5rem] border border-stroke bg-panel/82 p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-cyan" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">Data Passport</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-mist">Quellen, Frische und Analyse-Gates</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{passport.userMessage}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal px-4 py-3 text-sm text-muted">
          <p>Provider: <span className="text-mist">{passport.primaryProvider}</span></p>
          <p className="mt-1">Erstellt: {formatTimestamp(passport.generatedAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Entscheidung" value={passport.decision.replace("analysis_", "")} tone={passport.decision === "analysis_blocked" ? "text-loss" : passport.decision === "analysis_limited" ? "text-amber" : "text-profit"} />
        <Metric label="Qualität" value={`${passport.qualityScore}/100`} tone="text-cyan" />
        <Metric label="Konfidenz" value={`${passport.confidence}/100`} tone="text-cyan" />
        <Metric label="Fehlend/blockiert" value={`${passport.missingSources}`} tone={passport.missingSources ? "text-amber" : "text-profit"} />
        <Metric label="Mock-Quellen" value={`${passport.mockSources}`} tone={passport.mockSources ? "text-loss" : "text-profit"} />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.85fr_0.75fr_0.75fr_0.9fr_1fr_1.25fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted xl:grid">
          <span>Bereich</span>
          <span>Status</span>
          <span>Qualität</span>
          <span>asOf</span>
          <span>Referenz</span>
          <span>Hinweis</span>
        </div>
        <div className="divide-y divide-stroke">
          {passport.entries.map((entry) => (
            <article key={entry.id} className="grid gap-3 bg-panel/55 px-4 py-4 xl:grid-cols-[0.85fr_0.75fr_0.75fr_0.9fr_1fr_1.25fr] xl:items-start">
              <div>
                <p className="font-semibold text-mist">{entry.label}</p>
                <p className="mt-1 text-xs text-muted">{entry.provider}</p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${provenanceStatusTone(entry.status)}`}>
                {entry.status}
              </span>
              <span className="w-fit rounded-full border border-stroke bg-coal px-3 py-1 text-xs font-semibold text-muted">
                {entry.quality.toUpperCase()}
              </span>
              <p className="text-xs leading-5 text-muted">{formatTimestamp(entry.asOf)}<br />{entry.timezone}</p>
              <p className="break-all font-mono text-[11px] leading-5 text-cyan">{entry.sourceReference}</p>
              <p className="text-xs leading-5 text-muted">{entry.note}</p>
            </article>
          ))}
        </div>
      </div>

      {passport.blockers.length ? (
        <div className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-4">
          <p className="text-sm font-semibold text-amber">Blocker und Unsicherheiten</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {passport.blockers.map((blocker) => (
              <p key={blocker} className="rounded-xl border border-amber/20 bg-coal/45 px-3 py-2 text-xs leading-5 text-muted">
                {blocker}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function forecastStatusTone(status: ForecastPassport["status"]) {
  if (status === "ready") return "border-profit/30 bg-profit/10 text-profit";
  if (status === "limited") return "border-amber/30 bg-amber/10 text-amber";
  return "border-loss/35 bg-loss/10 text-loss";
}

function formatMaybePercent(value: number | null | undefined) {
  return isFiniteNumber(value) ? formatPercent(value) : "blockiert";
}

function ForecastPassportPanel({ passport }: { passport: ForecastPassport }) {
  return (
    <section className="rounded-[1.5rem] border border-stroke bg-[radial-gradient(circle_at_top_left,rgba(43,210,150,0.14),transparent_34%),linear-gradient(145deg,rgba(13,20,32,0.96),rgba(6,11,20,0.98))] p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-profit" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-profit">Forecast Passport</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-mist">Szenarien statt Scheinsicherheit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{passport.userMessage}</p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${forecastStatusTone(passport.status)}`}>
          {passport.label}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Modell-Konfidenz" value={`${passport.confidence}/100`} tone={passport.status === "blocked" ? "text-loss" : "text-cyan"} />
        <Metric label="Datenqualität" value={`${passport.qualityScore}/100`} tone="text-cyan" />
        <Metric label="Chance steigend" value={passport.status === "blocked" ? "blockiert" : `${passport.probabilityUp}%`} tone="text-profit" />
        <Metric label="Chance fallend" value={passport.status === "blocked" ? "blockiert" : `${passport.probabilityDown}%`} tone="text-loss" />
        <Metric label="Seitwärts" value={passport.status === "blocked" ? "blockiert" : `${passport.probabilitySideways}%`} tone="text-amber" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-stroke">
          <div className="grid grid-cols-[0.7fr_1fr_1fr_1fr] gap-2 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <span>Horizont</span>
            <span>Band unten</span>
            <span>Mitte</span>
            <span>Band oben</span>
          </div>
          <div className="divide-y divide-stroke">
            {passport.bands.map((band) => (
              <div key={band.horizon} className="grid grid-cols-[0.7fr_1fr_1fr_1fr] gap-2 bg-panel/45 px-4 py-3 text-sm">
                <span className="font-semibold text-mist">{band.label}</span>
                <span className="font-mono text-loss">{formatMaybePercent(band.lowerReturnPercent)}</span>
                <span className="font-mono text-cyan">{formatMaybePercent(band.medianReturnPercent)}</span>
                <span className="font-mono text-profit">{formatMaybePercent(band.upperReturnPercent)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {passport.scenarios.map((scenario) => (
            <article key={scenario.id} className="rounded-2xl border border-stroke bg-panel/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-mist">{scenario.label}</p>
                <span className="rounded-full border border-stroke bg-coal px-3 py-1 font-mono text-xs text-muted">
                  {scenario.probability}%
                </span>
              </div>
              <p className="mt-2 font-mono text-lg text-cyan">
                {scenario.projectedPrice === null ? "keine Zielspanne" : formatCurrency(scenario.projectedPrice, passport.currency)}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">{scenario.rationale}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-profit/20 bg-profit/10 p-4">
          <p className="text-sm font-semibold text-profit">Wichtigste Treiber</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted">
            {passport.drivers.length ? passport.drivers.map((driver) => <li key={driver}>{driver}</li>) : <li>Keine belastbaren Treiber verfügbar.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-loss/20 bg-loss/10 p-4">
          <p className="text-sm font-semibold text-loss">Risiken und Blocker</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted">
            {[...passport.risks, ...passport.blockers].slice(0, 6).map((risk) => <li key={risk}>{risk}</li>)}
            {!passport.risks.length && !passport.blockers.length ? <li>Keine zusätzlichen Blocker in der aktuellen Datenbasis.</li> : null}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stroke bg-coal/70 p-4 text-xs leading-5 text-muted">
        <p>
          Modell: <span className="font-mono text-cyan">{passport.modelVersion}</span> · Datenstand: {formatTimestamp(passport.dataCutoff)} · Provider: {passport.provider} · Qualität: {passport.quality.toUpperCase()}
        </p>
        <p className="mt-2">{legalDisclaimer}</p>
      </div>
    </section>
  );
}

export function AssetDetailView({
  detail,
  valuation = null,
  filings = null,
  insider = null,
  corporateActions
}: {
  detail: AssetDetail;
  /**
   * Bewertung, Kennzahlen mit Einordnung, Peers und Analysten.
   *
   * Optional und `null`, wenn der Abruf der Abschlussdaten ausgefallen ist. Die
   * betreffenden Abschnitte entfallen dann ganz — ein leerer Bewertungsteil
   * wäre eine Behauptung über fehlende Daten statt einer Auskunft.
   */
  valuation?: ValuationView | null;
  /** Einreichungen bei der SEC. `null` bei Nicht-US-Emittenten. */
  filings?: CompanyFilings | null;
  /** Insidertransaktionen aus Formular 4. */
  insider?: { transactions: InsiderTransaction[]; summary: InsiderSummary } | null;
  /** Provider-gemeldete Dividenden/Splits mit expliziter Teilabdeckung. */
  corporateActions: CorporateActionsResult;
}) {
  const [range, setRange] = useState<TimeRange>("1M");
  const [showSma, setShowSma] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  useEffect(() => {
    const stored = readOfflineValue<Partial<ChartPreferences>>(CHART_PREFS_KEY);
    if (!stored) return;
    if (stored.range && timeRanges.includes(stored.range)) setRange(stored.range);
    if (typeof stored.showSma === "boolean") setShowSma(stored.showSma);
    if (typeof stored.showVolume === "boolean") setShowVolume(stored.showVolume);
    if (typeof stored.showBenchmark === "boolean") setShowBenchmark(stored.showBenchmark);
  }, []);
  useEffect(() => {
    saveOfflineValue(CHART_PREFS_KEY, { range, showSma, showVolume, showBenchmark });
  }, [range, showBenchmark, showSma, showVolume]);
  const chartToggles: Array<{ label: string; value: boolean; set: Dispatch<SetStateAction<boolean>> }> = [
    { label: "SMA 20/50/200", value: showSma, set: setShowSma },
    { label: "Volumen", value: showVolume, set: setShowVolume },
    { label: "Benchmark", value: showBenchmark, set: setShowBenchmark }
  ];
  const candles = useMemo(() => (detail.candles[range] ?? []).filter(isUsableCandle), [detail.candles, range]);
  const stream = useMarketStream([detail.asset.symbol]);
  const displayedQuote = useMemo<Quote>(() => {
    const liveQuote = stream.quotes[detail.asset.symbol];
    if (!liveQuote) return detail.quote;

    return {
      ...detail.quote,
      price: liveQuote.price,
      change: liveQuote.change,
      changePercent: liveQuote.changePercent,
      dayHigh: liveQuote.high ?? detail.quote.dayHigh,
      dayLow: liveQuote.low ?? detail.quote.dayLow,
      volume: liveQuote.volume ?? detail.quote.volume,
      delayedByMinutes: liveQuote.quality === "delayed" ? Math.max(detail.quote.delayedByMinutes, 15) : 0,
      asOf: liveQuote.timestamp,
      bid: liveQuote.bid,
      ask: liveQuote.ask,
      spread: liveQuote.spread,
      open: liveQuote.open ?? detail.quote.open,
      previousClose: liveQuote.previousClose ?? detail.quote.previousClose,
      fiftyTwoWeekHigh: liveQuote.fiftyTwoWeekHigh ?? detail.quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: liveQuote.fiftyTwoWeekLow ?? detail.quote.fiftyTwoWeekLow,
      provider: liveQuote.provider,
      quality: liveQuote.quality,
      latencyMs: liveQuote.latencyMs,
      marketStatus: liveQuote.marketStatus
    };
  }, [detail.asset.symbol, detail.quote, stream.quotes]);
  const displayedDetail = useMemo<AssetDetail>(() => ({ ...detail, quote: displayedQuote }), [detail, displayedQuote]);
  const readiness = useMemo(() => buildAssetReadiness(displayedDetail), [displayedDetail]);
  const fundamentalMetrics = useMemo(() => buildFundamentalMetrics(displayedDetail), [displayedDetail]);
  const provenancePassport = useMemo(() => buildAssetProvenancePassport(displayedDetail), [displayedDetail]);
  const forecastPassport = useMemo(() => buildForecastPassport(displayedDetail), [displayedDetail]);
  const positive = isFiniteNumber(displayedQuote.changePercent) ? displayedQuote.changePercent >= 0 : false;
  const chartStats = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0];
    if (!isFiniteNumber(first.close) || first.close <= 0) return null;
    const closes = candles.map((candle) => candle.close);
    const volumes = candles.map((candle) => candle.volume ?? 0);
    const periodReturnPercent = first.close ? ((candles[candles.length - 1].close - first.close) / first.close) * 100 : 0;
    const high = Math.max(...candles.map((candle) => candle.high));
    const low = Math.min(...candles.map((candle) => candle.low));
    const averageVolume = volumes.reduce((sum, value) => sum + value, 0) / Math.max(1, volumes.length);
    const returns = closes
      .slice(1)
      .map((close, index) => Math.log(close / Math.max(0.0001, closes[index])))
      .filter(Number.isFinite);
    const averageReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
    const variance = returns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / Math.max(1, returns.length);
    const volatilityPercent = Math.sqrt(variance) * Math.sqrt(252) * 100;
    let peak = first.close;
    let maxDrawdownPercent = 0;

    closes.forEach((close) => {
      peak = Math.max(peak, close);
      maxDrawdownPercent = Math.min(maxDrawdownPercent, ((close - peak) / peak) * 100);
    });

    return {
      averageVolume,
      high,
      low,
      maxDrawdownPercent,
      periodReturnPercent,
      volatilityPercent
    };
  }, [candles]);
  const benchmarkCandles = useMemo(() => {
    const base = isFiniteNumber(candles[0]?.close) && candles[0].close > 0
      ? candles[0].close
      : isFiniteNumber(displayedQuote.price) && displayedQuote.price > 0
        ? displayedQuote.price
        : 1;
    return candles.map((candle, index) => {
      const drift = 1 + index * 0.0018;
      const wave = Math.sin(index / 3) * 0.012;
      const close = base * (drift + wave);

      return {
        ...candle,
        symbol: "SPX",
        open: close * 0.997,
        high: close * 1.006,
        low: close * 0.994,
        close
      };
    });
  }, [candles, displayedQuote.price]);
  const aiCards = useMemo(
    () => [
      ["Bull Case", detail.aiAnalysis.bullCase],
      ["Bear Case", detail.aiAnalysis.bearCase],
      ["Neutral Case", detail.aiAnalysis.neutralCase],
      ["Kurzfristig", detail.aiAnalysis.shortTerm],
      ["Mittelfristig", detail.aiAnalysis.mediumTerm],
      ["Langfristig", detail.aiAnalysis.longTerm]
    ],
    [detail.aiAnalysis]
  );

  useEffect(() => {
    saveOfflineValue(`${OFFLINE_KEYS.analyses}:${detail.asset.symbol}`, detail.aiAnalysis);
  }, [detail.aiAnalysis, detail.asset.symbol]);

  return (
    <div className="space-y-7">
      {/* Reihenfolge nach §49: Übersicht, Chart, Summary, Bewertung und
          Fundamentaldaten, technische Analyse, News, dann Qualität und Risiko,
          zuletzt die Szenarien. Der Chart stand vorher an zehnter Stelle und
          die News ganz am Ende — beides genau umgekehrt zur Blickrichtung
          eines Lesers, der eine Aktie zum ersten Mal öffnet. */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-stroke bg-[linear-gradient(140deg,#101712,#07100d_70%,#172114)] p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-panel2 px-2 py-1 text-xs uppercase text-muted">
                  {detail.asset.exchange}
                </span>
                <span className="rounded-md bg-cyan/10 px-2 py-1 text-xs uppercase text-cyan">
                  {detail.asset.type}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                {detail.asset.symbol}
              </h1>
              <p className="mt-1 text-sm text-muted">{detail.asset.name}</p>
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm ${riskTone(detail.aiRisk)}`}>
              Risiko {detail.aiRisk}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-4xl font-semibold">
                {formatCurrency(displayedQuote.price, detail.asset.currency)}
              </p>
              <p className={positive ? "mt-2 text-profit" : "mt-2 text-loss"}>
                {positive ? "+" : ""}
                {formatCurrency(displayedQuote.change, detail.asset.currency)} ({formatPercent(displayedQuote.changePercent)})
              </p>
            </div>
            <div className="text-left sm:text-right">
              <MarketDataStatus quote={displayedQuote} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ScoreMeter score={detail.scores.total} label="Gesamt-Score" />
          <div className="rounded-md border border-stroke bg-panel p-4">
            <p className={`text-sm ${scoreTone(detail.scores.total)}`}>
              {scoreLabel(detail.scores.total)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">{detail.asset.description}</p>
          </div>
        </div>
      </section>

      <section className={`space-y-3 ${chartFullscreen ? "fixed inset-0 z-[80] overflow-y-auto bg-[#050b14] p-3 sm:p-6" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-cyan" />
              <h2 className="text-lg font-semibold">Profi-Chart</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Benchmark-Overlay ist modelliert. Echte Benchmark-Daten brauchen einen lizenzierten Index-/ETF-Provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-stroke bg-panel p-1" role="group" aria-label="Chart-Zeitraum wählen">
              {timeRanges.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={range === item}
                  aria-label={`Zeitraum ${item} anzeigen`}
                  onClick={() => setRange(item)}
                  className={`min-h-11 min-w-11 shrink-0 rounded px-3 text-sm transition ${
                    range === item ? "bg-profit text-ink" : "text-muted hover:bg-panel2 hover:text-mist"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setChartFullscreen((current) => !current)}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-cyan/30 bg-cyan/10 px-3 text-sm font-semibold text-cyan"
            >
              {chartFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {chartFullscreen ? "Schließen" : "Vollbild"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border border-stroke bg-panel p-2" role="group" aria-label="Chart-Indikatoren steuern">
          {chartToggles.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={item.value}
              onClick={() => item.set((current) => !current)}
              className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${
                item.value ? "border-profit/35 bg-profit/10 text-profit" : "border-stroke bg-coal text-muted hover:text-mist"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <PriceLineChart
          candles={candles}
          benchmarkCandles={benchmarkCandles}
          benchmarkLabel="Benchmark"
          showBenchmark={showBenchmark}
          showSma={showSma}
          showVolume={showVolume}
        />
        {chartStats ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label={`Performance ${range}`} value={formatPercent(chartStats.periodReturnPercent)} tone={chartStats.periodReturnPercent >= 0 ? "text-profit" : "text-loss"} />
            <Metric label="Volatilität geschätzt" value={formatPercent(chartStats.volatilityPercent)} tone="text-amber" />
            <Metric label="Max. Drawdown" value={formatPercent(chartStats.maxDrawdownPercent)} tone="text-loss" />
            <Metric label="Ø Volumen" value={formatCompact(chartStats.averageVolume)} />
            <Metric label="Range-Hoch" value={formatCurrency(chartStats.high, detail.asset.currency)} tone="text-profit" />
            <Metric label="Range-Tief" value={formatCurrency(chartStats.low, detail.asset.currency)} tone="text-loss" />
            <Metric label="Chart-Modus" value={showBenchmark ? "Benchmark aktiv" : "Asset pur"} tone="text-cyan" />
            <Metric label="Präferenzen" value="Offline gespeichert" tone="text-cyan" />
          </div>
        ) : null}
        <CandlestickChart candles={candles} />
      </section>

      <AssetDecisionPanel detail={detail} />

      {/* §49 Platz 4 bis 6: Bewertung, dann Kennzahlen mit historischer
          Einordnung, dann die Vergleichsgruppe. Alles nur, wenn die
          Abschlussdaten geladen werden konnten. */}
      {valuation ? (
        <>
          {valuation.sensitivity ? (
            <ValuationPanel
              dcf={valuation.dcf}
              sensitivity={valuation.sensitivity}
              impliedGrowth={valuation.impliedGrowth}
              yields={valuation.yields}
              currency={detail.asset.currency}
            />
          ) : null}

          {valuation.metrics.length ? (
            <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
              <h2 className="text-lg font-semibold">Kennzahlen im Fünfjahresvergleich</h2>
              <p className="mt-1 text-xs text-muted">{valuation.note}</p>
              <div className="mt-3">
                <MetricGrid results={valuation.metrics} />
              </div>
            </section>
          ) : null}

          {valuation.analysts ? (
            <AnalystPanel view={valuation.analysts} currency={detail.asset.currency} price={displayedQuote.price} />
          ) : null}

          {valuation.peers.length ? <PeerComparisonPanel comparisons={valuation.peers} /> : null}
        </>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Bid / Ask"
          value={
            displayedQuote.bid !== undefined && displayedQuote.ask !== undefined
              ? `${formatCurrency(displayedQuote.bid, detail.asset.currency)} / ${formatCurrency(displayedQuote.ask, detail.asset.currency)}`
              : "vom Anbieter nicht geliefert"
          }
        />
        <Metric
          label="Spread"
          value={displayedQuote.spread !== undefined ? formatCurrency(displayedQuote.spread, detail.asset.currency) : "vom Anbieter nicht geliefert"}
          tone={displayedQuote.spread !== undefined && isFiniteNumber(displayedQuote.price) ? "text-cyan" : undefined}
        />
        <Metric
          label="Tageshoch / Tief"
          value={`${formatCurrency(displayedQuote.dayHigh, detail.asset.currency)} / ${formatCurrency(displayedQuote.dayLow, detail.asset.currency)}`}
        />
        <Metric
          label="Open / Prev. Close"
          value={`${formatMaybeCurrency(displayedQuote.open, detail.asset.currency)} / ${formatMaybeCurrency(displayedQuote.previousClose, detail.asset.currency)}`}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Transparentes Score-Modell</h2>
        <ProfessionalScoresPanel scores={detail.professionalScores} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreMeter score={detail.scores.trend} label="Legacy Trend Score" />
          <ScoreMeter score={detail.scores.news} label="Legacy News Score" />
          <ScoreMeter score={detail.scores.risk} label="Legacy Risk Score" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber" />
            <h2 className="text-lg font-semibold">KI-Einschätzung</h2>
          </div>
          <div className="rounded-md border border-stroke bg-panel p-4">
            <p className="text-sm leading-6 text-muted">{detail.aiAnalysis.summary}</p>
            <div className="mt-4">
              <ProbabilityPanel scores={detail.professionalScores} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric label="KI-Unsicherheit" value={detail.aiAnalysis.uncertainty} tone="text-amber" />
              <Metric label="Datenvertrauen" value={`${detail.dataQuality.confidence}/100`} tone="text-cyan" />
            </div>
            {detail.aiAnalysis.weakDataWarning ? (
              <p className="mt-4 rounded-md border border-loss/30 bg-loss/10 p-3 text-xs leading-5 text-loss">
                {detail.aiAnalysis.weakDataWarning}
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-panel2 p-3">
                <div className="mb-2 flex items-center gap-2 text-profit">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-sm font-semibold">Warum könnte der Kurs steigen?</p>
                </div>
                <ul className="space-y-2 text-sm text-muted">
                  {detail.aiAnalysis.upsideDrivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-panel2 p-3">
                <div className="mb-2 flex items-center gap-2 text-loss">
                  <TrendingDown className="h-4 w-4" />
                  <p className="text-sm font-semibold">Warum könnte der Kurs fallen?</p>
                </div>
                <ul className="space-y-2 text-sm text-muted">
                  {detail.aiAnalysis.downsideDrivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-panel2 p-3">
                <p className="text-sm font-semibold text-amber">Gegenargumente</p>
                <ul className="mt-2 space-y-2 text-sm text-muted">
                  {detail.aiAnalysis.counterArguments.map((argument) => (
                    <li key={argument}>{argument}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-panel2 p-3">
                <p className="text-sm font-semibold text-amber">Datenlücken</p>
                <ul className="mt-2 space-y-2 text-sm text-muted">
                  {detail.aiAnalysis.dataGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-md bg-panel2 p-3">
              <p className="text-sm font-semibold">Quellenangaben</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.aiAnalysis.sources.map((source) => (
                  <span key={source} className="rounded-md border border-stroke px-2 py-1 text-xs text-muted">
                    {source}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-4 rounded-md border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
              {detail.aiAnalysis.modelNote} {legalDisclaimer}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber" />
            <h2 className="text-lg font-semibold">Cases und Termine</h2>
          </div>
          <div className="space-y-3">
            {aiCards.map(([label, text]) => (
              <div key={label} className="rounded-md border border-stroke bg-panel p-4">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
            <div className="rounded-md border border-stroke bg-panel p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-cyan" />
                <p className="text-sm font-semibold">Earnings / Kursziele / Insider</p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>Earnings: {detail.earningsDate ?? "nicht verfügbar"}</p>
                <p>
                  Provider-Rating:{" "}
                  {detail.analystOpinion
                    ? `${detail.analystOpinion.consensus}, Median ${formatCurrency(detail.analystOpinion.targetMedian, detail.asset.currency)}`
                    : "nicht verfügbar"}
                </p>
                <p>
                  Insiderdaten:{" "}
                  {detail.insiderActivity.length
                    ? `Transaktion gemeldet, Volumen ${formatCompact(detail.insiderActivity[0].value)}`
                    : "nicht verfügbar"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan" />
            <h2 className="text-lg font-semibold">Technische Indikatoren</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="RSI 14"
              value={detail.indicators.rsi === null ? "Zu wenig Daten" : detail.indicators.rsi.toFixed(1)}
              tone={
                detail.indicators.rsi === null
                  ? "text-muted"
                  : detail.indicators.rsi > 70
                    ? "text-loss"
                    : detail.indicators.rsi < 30
                      ? "text-amber"
                      : "text-profit"
              }
            />
            <Metric
              label="MACD"
              value={
                detail.indicators.macd
                  ? `${formatMaybeNumber(detail.indicators.macd.value)} / Signal ${formatMaybeNumber(detail.indicators.macd.signal)}`
                  : "Zu wenig Daten"
              }
            />
            <Metric label="SMA 20" value={formatMaybeCurrency(detail.indicators.movingAverages.ma20, detail.asset.currency)} />
            <Metric label="SMA 50" value={formatMaybeCurrency(detail.indicators.movingAverages.ma50, detail.asset.currency)} />
            <Metric label="SMA 200" value={formatMaybeCurrency(detail.indicators.movingAverages.ma200, detail.asset.currency)} />
            <Metric
              label="Bollinger Bänder"
              value={
                detail.indicators.bollingerBands
                  ? `${formatCurrency(detail.indicators.bollingerBands.lower, detail.asset.currency)} - ${formatCurrency(detail.indicators.bollingerBands.upper, detail.asset.currency)}`
                  : "Zu wenig Daten"
              }
            />
            <Metric label="Unterstützung" value={detail.indicators.support.length ? detail.indicators.support.map((value) => formatCurrency(value, detail.asset.currency)).join(" / ") : "Zu wenig Daten"} />
            <Metric label="Widerstand" value={detail.indicators.resistance.length ? detail.indicators.resistance.map((value) => formatCurrency(value, detail.asset.currency)).join(" / ") : "Zu wenig Daten"} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {detail.indicators.sampleSize === 0
              ? "Keine Kurshistorie verfügbar — es werden keine Indikatoren berechnet."
              : `Berechnet aus ${detail.indicators.sampleSize} Kerzen.${
                  detail.indicators.unavailable.length
                    ? ` Nicht berechenbar: ${detail.indicators.unavailable.join(", ")}.`
                    : ""
                }`}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-profit" />
            <h2 className="text-lg font-semibold">Fundamentaldaten</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fundamentalMetrics.map((metric) => (
              <Metric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                tone={metric.available ? undefined : "text-amber"}
              />
            ))}
          </div>
          {!readiness.trustedFundamentals ? (
            <p className="mt-3 rounded-md border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
              Fundamentaldaten sind für dieses Symbol aktuell nicht ausreichend verifiziert. STAI zeigt deshalb keine Nullwerte als echte Kennzahlen.
            </p>
          ) : null}
        </div>
      </section>

      <TechnicalTrendPanel detail={{ ...detail, quote: displayedQuote }} />

      <CorporateActionsPanel result={corporateActions} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Unternehmensnachrichten</h2>
        <NewsList news={detail.news} />
      </section>

      {/* §49 Platz 11 und 12: Insider, dann Filings -- beide nur bei
          US-Emittenten, weil die SEC nur diese erfasst. */}
      {insider && insider.transactions.length ? (
        <InsiderPanel
          transactions={insider.transactions}
          summary={insider.summary}
          currency={detail.asset.currency}
        />
      ) : null}

      {filings && filings.filings.length ? (
        <FilingsPanel filings={filings.filings} companyName={filings.companyName} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className={`rounded-[1.5rem] border p-5 shadow-panel ${readinessTone(readiness.status)}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-75">Analysefreigabe</p>
              <h2 className="mt-2 text-2xl font-semibold">{readiness.label}</h2>
            </div>
            <DatabaseZap className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm leading-6 opacity-90">{readiness.detail}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-current/20 bg-ink/25 p-3">
              <p className="text-xs opacity-70">Datenqualität</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{readiness.qualityScore}/100</p>
            </div>
            <div className="rounded-2xl border border-current/20 bg-ink/25 p-3">
              <p className="text-xs opacity-70">Konfidenz</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{readiness.confidence}/100</p>
            </div>
          </div>
          {readiness.missingAreas.length ? (
            <p className="mt-4 text-xs leading-5 opacity-80">
              Fehlende Bereiche: {readiness.missingAreas.join(", ")}.
            </p>
          ) : null}
        </div>
        <div className="rounded-[1.5rem] border border-stroke bg-panel/82 p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">Datenabdeckung</p>
              <h2 className="mt-2 text-xl font-semibold text-mist">Was ist wirklich nutzbar?</h2>
            </div>
            <span className="rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">
              Provider: {displayedQuote.provider}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {readiness.coverage.map((item) => (
              <article key={item.label} className={`rounded-2xl border p-3 ${qualityTone(item.available)}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <span className="rounded-full border border-current/25 px-2 py-1 text-[10px] uppercase">
                    {item.available ? "verfügbar" : "fehlt"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{item.note}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
            Wenn Daten fehlen, zeigt STAI keine Ersatz-Fundamentals und keine scheinpräzise Prognose. Das ist Absicht, nicht ein Darstellungsfehler.
          </p>
        </div>
      </section>

      <AssetProvenancePanel passport={provenancePassport} />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataQualityPanel quality={detail.dataQuality} />
        <RiskEnginePanel report={detail.riskReport} />
      </section>

      <section>
        <AnalysisLayersPanel layers={detail.analysisLayers} macroFactors={detail.macroFactors} />
      </section>

      <ForecastPassportPanel passport={forecastPassport} />
    </div>
  );
}
