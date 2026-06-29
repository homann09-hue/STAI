"use client";

import Link from "next/link";
import { Activity, Bell, ChevronRight, Search, Settings2, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Sparkline, ScoreMeter } from "@/components/charts";
import { CapitalCommandCenter } from "@/components/capital-command-center";
import { DashboardCommandGrid } from "@/components/dashboard-command-grid";
import { ConnectionBadge, LiveMarketTickerBar } from "@/components/live-market-widgets";
import {
  AIInsightCard,
  MarketNewsCard,
  MarketOverviewCard,
  MostActiveCard,
  PortfolioSnapshotCard,
  TopMoversCard,
  TrendingAssetsCard,
  WatchlistTable
} from "@/components/market-boxes";
import { MarketTerminalDashboard } from "@/components/market-terminal-dashboard";
import { MarketDataStatus } from "@/components/market-data-status";
import { NewsList } from "@/components/news-list";
import { RealtimeAssetChart } from "@/components/realtime-asset-chart";
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
import { useMarketStream } from "@/lib/use-market-stream";
import type { AssetDetail, AssetSummary, DashboardData, NormalizedQuote, Quote } from "@/lib/types";

function mergeLiveQuote(base: Quote, liveQuote?: NormalizedQuote): Quote {
  if (!liveQuote) return base;

  return {
    ...base,
    price: liveQuote.price,
    change: liveQuote.change,
    changePercent: liveQuote.changePercent,
    dayHigh: liveQuote.high ?? base.dayHigh,
    dayLow: liveQuote.low ?? base.dayLow,
    volume: liveQuote.volume ?? base.volume,
    delayedByMinutes: liveQuote.quality === "delayed" ? Math.max(base.delayedByMinutes, 15) : 0,
    asOf: liveQuote.timestamp,
    bid: liveQuote.bid,
    ask: liveQuote.ask,
    spread: liveQuote.spread,
    open: liveQuote.open ?? base.open,
    previousClose: liveQuote.previousClose ?? base.previousClose,
    provider: liveQuote.provider,
    quality: liveQuote.quality,
    latencyMs: liveQuote.latencyMs,
    marketStatus: liveQuote.marketStatus
  };
}

function AssetRow({ item, liveQuote }: { item: AssetSummary; liveQuote?: NormalizedQuote }) {
  const quote = mergeLiveQuote(item.quote, liveQuote);
  const positive = quote.changePercent >= 0;

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
            { symbol: item.asset.symbol, range: "1D", timestamp: quote.asOf, time: "", open: quote.price - 2, high: quote.price, low: quote.price - 4, close: quote.price - quote.change, volume: 1 },
            { symbol: item.asset.symbol, range: "1D", timestamp: quote.asOf, time: "", open: quote.price - 1, high: quote.price + 1, low: quote.price - 3, close: quote.price - quote.change / 2, volume: 1 },
            { symbol: item.asset.symbol, range: "1D", timestamp: quote.asOf, time: "", open: quote.price, high: quote.price + 2, low: quote.price - 2, close: quote.price, volume: 1 }
          ]}
          positive={positive}
        />
        <div className="text-right">
          <p className="font-mono text-xl font-semibold">{formatCurrency(quote.price, item.asset.currency)}</p>
          <p className={`mt-1 text-sm ${positive ? "text-profit" : "text-loss"}`}>
            {formatPercent(quote.changePercent)}
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
      <div className="mt-3">
        <MarketDataStatus quote={quote} compact />
      </div>
    </Link>
  );
}

function uniqueTickerItems(data: DashboardData) {
  const bySymbol = new Map<string, AssetSummary>();
  [...data.watchlist, ...data.mostActive, ...data.trendingAssets, ...data.gainers, ...data.losers].forEach((item) => {
    bySymbol.set(item.asset.symbol, item);
  });
  return [...bySymbol.values()].slice(0, 10);
}

export function DashboardView({ data, heroAsset }: { data: DashboardData; heroAsset?: AssetDetail | null }) {
  const visibleSymbols = useMemo(
    () =>
      [
        ...data.watchlist.map((item) => item.asset.symbol),
        ...data.gainers.map((item) => item.asset.symbol),
        ...data.losers.map((item) => item.asset.symbol),
        ...data.mostActive.map((item) => item.asset.symbol),
        ...data.trendingAssets.map((item) => item.asset.symbol)
      ],
    [data.gainers, data.losers, data.mostActive, data.trendingAssets, data.watchlist]
  );
  const stream = useMarketStream(visibleSymbols);
  const tickerItems = useMemo(() => uniqueTickerItems(data), [data]);
  const fallbackHero = data.watchlist[0] ?? data.gainers[0] ?? data.mostActive[0];
  const hero = heroAsset ?? fallbackHero;

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.watchlist, data.watchlist);
  }, [data.watchlist]);

  return (
    <div className="space-y-7">
      <section className="space-y-4 rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_left,rgba(120,231,255,0.16),transparent_30%),linear-gradient(145deg,rgba(8,12,20,0.98),rgba(3,6,10,0.98))] p-4 shadow-panel sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <label className="relative block">
            <span className="sr-only">Aktien, ETFs, Krypto oder Indizes suchen</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              placeholder="Suche nach Aktien, ETFs, Krypto, Indizes..."
              className="h-12 w-full rounded-2xl border border-stroke bg-coal pl-11 pr-4 text-sm text-mist outline-none transition placeholder:text-muted focus:border-cyan/60"
            />
          </label>
          <ConnectionBadge status={stream.connectionStatus} mode={stream.refreshMode} intervalMs={stream.intervalMs} />
          <div className="flex gap-2 overflow-x-auto">
            <Link href="/watchlist" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-stroke bg-panel px-4 text-sm font-semibold text-mist transition hover:border-profit/40">
              <Bell className="h-4 w-4 text-profit" />
              Watchlist
            </Link>
            <Link href="/settings" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-stroke bg-panel px-4 text-sm font-semibold text-mist transition hover:border-cyan/40">
              <Settings2 className="h-4 w-4 text-cyan" />
              Settings
            </Link>
          </div>
        </div>

        <LiveMarketTickerBar items={tickerItems} liveQuotes={stream.quotes} title="Globale Kursübersicht" />

        {hero ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.8fr)]">
            <RealtimeAssetChart
              asset={hero.asset}
              quote={hero.quote}
              liveQuote={stream.quotes[hero.asset.symbol]}
              candlesByRange={heroAsset?.candles}
              indicators={heroAsset?.indicators}
              connectionStatus={stream.connectionStatus}
              refreshMode={stream.refreshMode}
              intervalMs={stream.intervalMs}
            />
            <div className="space-y-4">
              <TopMoversCard title="Top Gewinner" items={data.gainers} liveQuotes={stream.quotes} direction="up" />
              <TopMoversCard title="Top Verlierer" items={data.losers} liveQuotes={stream.quotes} direction="down" />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <MostActiveCard items={data.mostActive} liveQuotes={stream.quotes} />
          <TrendingAssetsCard items={data.trendingAssets} liveQuotes={stream.quotes} />
          <AIInsightCard data={data} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <WatchlistTable items={data.watchlist} liveQuotes={stream.quotes} />
          <div className="space-y-4">
            <MarketOverviewCard data={data} />
            <PortfolioSnapshotCard data={data} />
          </div>
        </div>

        <MarketNewsCard news={data.latestNews} />
      </section>

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

      <MarketTerminalDashboard data={data} liveQuotes={stream.quotes} />

      <CapitalCommandCenter data={data} />

      <DashboardCommandGrid data={data} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="text-xs text-muted">Offline gespeichert</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.watchlist.map((item) => (
            <AssetRow key={item.asset.symbol} item={item} liveQuote={stream.quotes[item.asset.symbol]} />
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
              <AssetRow key={item.asset.symbol} item={item} liveQuote={stream.quotes[item.asset.symbol]} />
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
              <AssetRow key={item.asset.symbol} item={item} liveQuote={stream.quotes[item.asset.symbol]} />
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
