"use client";

import { useEffect, useMemo, useState } from "react";
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
  ShieldAlert,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { CandlestickChart, PriceLineChart, ScoreMeter } from "@/components/charts";
import { NewsList } from "@/components/news-list";
import { OFFLINE_KEYS, saveOfflineValue } from "@/lib/offline";
import {
  formatCompact,
  formatCurrency,
  formatPercent,
  legalDisclaimer,
  riskTone,
  scoreLabel,
  scoreTone
} from "@/lib/scoring";
import type { AssetDetail, TimeRange } from "@/lib/types";
import { timeRanges } from "@/lib/types";

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 font-mono text-lg font-semibold ${tone ?? "text-mist"}`}>{value}</p>
    </div>
  );
}

export function AssetDetailView({ detail }: { detail: AssetDetail }) {
  const [range, setRange] = useState<TimeRange>("1M");
  const candles = detail.candles[range];
  const positive = detail.quote.changePercent >= 0;
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
                {formatCurrency(detail.quote.price, detail.asset.currency)}
              </p>
              <p className={positive ? "mt-2 text-profit" : "mt-2 text-loss"}>
                {positive ? "+" : ""}
                {formatCurrency(detail.quote.change, detail.asset.currency)} ({formatPercent(detail.quote.changePercent)})
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted">Delay</p>
              <p className="font-mono text-lg">{detail.quote.delayedByMinutes} Min.</p>
              <p className="mt-1 text-xs text-muted">
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short"
                }).format(new Date(detail.quote.asOf))}
              </p>
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

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataQualityPanel quality={detail.dataQuality} />
        <RiskEnginePanel report={detail.riskReport} />
      </section>

      <section>
        <AnalysisLayersPanel layers={detail.analysisLayers} macroFactors={detail.macroFactors} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Chart</h2>
          <div className="flex rounded-md border border-stroke bg-panel p-1">
            {timeRanges.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`h-9 rounded px-3 text-sm transition ${
                  range === item ? "bg-profit text-ink" : "text-muted hover:bg-panel2 hover:text-mist"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <PriceLineChart candles={candles} />
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
            <Metric label="MACD" value={`${detail.indicators.macd.value} / Signal ${detail.indicators.macd.signal}`} />
            <Metric label="MA 20" value={formatCurrency(detail.indicators.movingAverages.ma20, detail.asset.currency)} />
            <Metric label="MA 50" value={formatCurrency(detail.indicators.movingAverages.ma50, detail.asset.currency)} />
            <Metric label="MA 200" value={formatCurrency(detail.indicators.movingAverages.ma200, detail.asset.currency)} />
            <Metric
              label="Bollinger Bands"
              value={`${detail.indicators.bollingerBands.lower} - ${detail.indicators.bollingerBands.upper}`}
            />
            <Metric label="Support" value={detail.indicators.support.join(" / ")} />
            <Metric label="Resistance" value={detail.indicators.resistance.join(" / ")} />
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
            <Metric label="Volumen" value={formatCompact(detail.quote.volume)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber" />
            <h2 className="text-lg font-semibold">KI-Analyse</h2>
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
                  <p className="text-sm font-semibold">Warum konnte der Kurs steigen?</p>
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
                  <p className="text-sm font-semibold">Warum konnte der Kurs fallen?</p>
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
                <p className="text-sm font-semibold text-amber">Datenluecken</p>
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
                <p>Earnings: {detail.earningsDate ?? "nicht verfugbar"}</p>
                <p>
                  Provider-Rating:{" "}
                  {detail.analystOpinion
                    ? `${detail.analystOpinion.consensus}, Median ${formatCurrency(detail.analystOpinion.targetMedian, detail.asset.currency)}`
                    : "nicht verfugbar"}
                </p>
                <p>
                  Insiderdaten:{" "}
                  {detail.insiderActivity.length
                    ? `Transaktion gemeldet, Volumen ${formatCompact(detail.insiderActivity[0].value)}`
                    : "nicht verfugbar"}
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
