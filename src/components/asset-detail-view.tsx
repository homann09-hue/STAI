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
import { useMarketStream } from "@/lib/use-market-stream";
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

export function AssetDetailView({ detail }: { detail: AssetDetail }) {
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

      <AssetDecisionPanel detail={detail} />

      <TechnicalTrendPanel detail={{ ...detail, quote: displayedQuote }} />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataQualityPanel quality={detail.dataQuality} />
        <RiskEnginePanel report={detail.riskReport} />
      </section>

      <section>
        <AnalysisLayersPanel layers={detail.analysisLayers} macroFactors={detail.macroFactors} />
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Transparentes Score-Modell</h2>
        <ProfessionalScoresPanel scores={detail.professionalScores} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreMeter score={detail.scores.trend} label="Legacy Trend Score" />
          <ScoreMeter score={detail.scores.news} label="Legacy News Score" />
          <ScoreMeter score={detail.scores.risk} label="Legacy Risk Score" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan" />
            <h2 className="text-lg font-semibold">Technische Indikatoren</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="RSI" value={`${detail.indicators.rsi}`} tone={detail.indicators.rsi > 70 ? "text-loss" : detail.indicators.rsi < 30 ? "text-amber" : "text-profit"} />
            <Metric label="MACD" value={`${formatMaybeNumber(detail.indicators.macd.value)} / Signal ${formatMaybeNumber(detail.indicators.macd.signal)}`} />
            <Metric label="MA 20" value={formatCurrency(detail.indicators.movingAverages.ma20, detail.asset.currency)} />
            <Metric label="MA 50" value={formatCurrency(detail.indicators.movingAverages.ma50, detail.asset.currency)} />
            <Metric label="MA 200" value={formatCurrency(detail.indicators.movingAverages.ma200, detail.asset.currency)} />
            <Metric
              label="Bollinger Bands"
              value={`${formatMaybeCurrency(detail.indicators.bollingerBands.lower, detail.asset.currency)} - ${formatMaybeCurrency(detail.indicators.bollingerBands.upper, detail.asset.currency)}`}
            />
            <Metric label="Support" value={detail.indicators.support.length ? detail.indicators.support.map((value) => formatMaybeCurrency(value, detail.asset.currency)).join(" / ") : "n/a"} />
            <Metric label="Resistance" value={detail.indicators.resistance.length ? detail.indicators.resistance.map((value) => formatMaybeCurrency(value, detail.asset.currency)).join(" / ") : "n/a"} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-profit" />
            <h2 className="text-lg font-semibold">Fundamentaldaten</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="KGV" value={detail.fundamentals.peRatio === null ? "n/a" : `${detail.fundamentals.peRatio}`} />
            <Metric label="Umsatzwachstum" value={formatPercent(detail.fundamentals.revenueGrowth)} />
            <Metric label="Gewinnwachstum" value={formatPercent(detail.fundamentals.earningsGrowth)} />
            <Metric label="Verschuldung" value={`${detail.fundamentals.debtToEquity.toFixed(2)} D/E`} />
            <Metric label="Cashflow" value={formatCompact(detail.fundamentals.cashflow)} />
            <Metric label="Dividende" value={detail.fundamentals.dividendYield === null ? "n/a" : `${detail.fundamentals.dividendYield}%`} />
            <Metric label="Marktkapitalisierung" value={formatCompact(detail.fundamentals.marketCap)} />
            <Metric label="Volumen" value={formatCompact(displayedQuote.volume)} />
          </div>
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Unternehmensnachrichten</h2>
        <NewsList news={detail.news} />
      </section>
    </div>
  );
}
