"use client";

import Link from "next/link";
import { Activity, ChevronRight, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect } from "react";
import { Sparkline, ScoreMeter } from "@/components/charts";
import { CapitalCommandCenter } from "@/components/capital-command-center";
import { DashboardCommandGrid } from "@/components/dashboard-command-grid";
import { NewsList } from "@/components/news-list";
import { OFFLINE_KEYS, saveOfflineValue } from "@/lib/offline";
import {
  formatCompact,
  formatCurrency,
  formatPercent,
  mockDataDisclaimer,
  riskTone,
  scoreLabel,
  scoreTone
} from "@/lib/scoring";
import type { AssetSummary, DashboardData } from "@/lib/types";

function AssetRow({ item }: { item: AssetSummary }) {
  const positive = item.quote.changePercent >= 0;

  return (
    <Link
      href={`/assets/${encodeURIComponent(item.asset.symbol)}`}
      className="block rounded-md border border-stroke bg-panel p-4 transition hover:border-cyan/40 hover:bg-panel2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.asset.symbol}</p>
            <span className="rounded-md bg-panel2 px-2 py-1 text-[10px] uppercase tracking-wide text-muted">
              {item.asset.type}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-muted">{item.asset.name}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
        <Sparkline
          candles={[
            { time: "", open: item.quote.price - 2, high: item.quote.price, low: item.quote.price - 4, close: item.quote.price - item.quote.change, volume: 1 },
            { time: "", open: item.quote.price - 1, high: item.quote.price + 1, low: item.quote.price - 3, close: item.quote.price - item.quote.change / 2, volume: 1 },
            { time: "", open: item.quote.price, high: item.quote.price + 2, low: item.quote.price - 2, close: item.quote.price, volume: 1 }
          ]}
          positive={positive}
        />
        <div className="text-right">
          <p className="font-mono text-xl font-semibold">{formatCurrency(item.quote.price, item.asset.currency)}</p>
          <p className={`mt-1 text-sm ${positive ? "text-profit" : "text-loss"}`}>
            {formatPercent(item.quote.changePercent)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`text-xs ${scoreTone(item.scores.total)}`}>
          Score {item.scores.total}: {scoreLabel(item.scores.total)}
        </span>
        <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(item.aiRisk)}`}>
          Risiko {item.aiRisk}
        </span>
      </div>
    </Link>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.watchlist, data.watchlist);
  }, [data.watchlist]);

  return (
    <div className="space-y-7">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-stroke bg-[linear-gradient(145deg,#101712,#07100d_65%,#122019)] p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">KI-Marktsentiment und Kapitalradar</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                {data.aiSentiment.label}
              </h1>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-md border border-profit/25 bg-profit/10 text-profit">
              <Activity className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">{data.aiSentiment.summary}</p>
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted">Marktübersicht</p>
            <div className="grid grid-cols-3 gap-2">
              {data.marketOverview.slice(0, 3).map((item) => (
                <div key={item.label} className="rounded-md border border-stroke bg-ink/40 p-3">
                  <p className="text-xs text-muted">{item.label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{item.value}</p>
                  <p className={item.changePercent >= 0 ? "text-xs text-profit" : "text-xs text-loss"}>
                    {formatPercent(item.changePercent)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ScoreMeter score={data.aiSentiment.score} label="Markt Score" />
          <div className="rounded-md border border-cyan/25 bg-cyan/10 p-4">
            <p className="text-sm font-semibold text-cyan">Datenqualität</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{data.dataQualitySummary.score}/100</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {data.dataQualitySummary.label}, {data.dataQualitySummary.mockSources} Mock-Quellen,
              {data.dataQualitySummary.staleSources} veraltete Quellen.
            </p>
            <p className="mt-2 text-xs leading-5 text-amber">{mockDataDisclaimer}</p>
          </div>
          <div className="rounded-md border border-stroke bg-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber" />
              <h2 className="text-sm font-semibold">Risiko-Warnungen</h2>
            </div>
            <div className="space-y-3">
              {data.riskWarnings.map((warning) => (
                <div key={warning.id} className="rounded-md bg-panel2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{warning.symbol}</p>
                    <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(warning.severity)}`}>
                      {warning.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-mist">{warning.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{warning.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CapitalCommandCenter data={data} />

      <DashboardCommandGrid data={data} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="text-xs text-muted">Offline gespeichert</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.watchlist.map((item) => (
            <AssetRow key={item.asset.symbol} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-profit" />
            <h2 className="text-lg font-semibold">Top Gewinner</h2>
          </div>
          <div className="space-y-3">
            {data.gainers.map((item) => (
              <AssetRow key={item.asset.symbol} item={item} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-loss" />
            <h2 className="text-lg font-semibold">Top Verlierer</h2>
          </div>
          <div className="space-y-3">
            {data.losers.map((item) => (
              <AssetRow key={item.asset.symbol} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Aktuelle Trends</h2>
          <div className="flex flex-wrap gap-2">
            {data.trends.map((trend) => (
              <span key={trend} className="rounded-md border border-stroke bg-panel px-3 py-2 text-sm text-mist">
                {trend}
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-stroke bg-panel p-4">
            <p className="text-sm text-muted">Gesamtvolumen Watchlist</p>
            <p className="mt-2 font-mono text-2xl font-semibold">
              {formatCompact(data.watchlist.reduce((sum, item) => sum + item.quote.volume, 0))}
            </p>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">News nach Relevanz</h2>
          <NewsList news={data.latestNews} />
        </div>
      </section>
    </div>
  );
}
