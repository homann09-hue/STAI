"use client";

import Link from "next/link";
import { ArrowDownWideNarrow, Flame, Gauge, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { MarketDataStatus } from "@/components/market-data-status";
import { Sparkline } from "@/components/charts";
import { mergeLiveQuote } from "@/lib/quotes";
import { formatCompact, formatCurrency, formatPercent, scoreLabel, scoreTone } from "@/lib/scoring";
import type { AssetSummary, AssetType, DashboardData, NormalizedQuote, Quote } from "@/lib/types";

type SortKey = "symbol" | "price" | "change" | "volume" | "score";
type FilterKey = "all" | AssetType | "watchlist";

function uniqueAssets(data: DashboardData) {
  const bySymbol = new Map<string, AssetSummary>();
  [...data.watchlist, ...data.gainers, ...data.losers, ...data.mostActive, ...data.trendingAssets].forEach((item) => {
    bySymbol.set(item.asset.symbol, item);
  });
  return [...bySymbol.values()];
}

function trendLabel(item: AssetSummary) {
  const momentum = item.professionalScores?.momentum ?? item.scores.trend;
  if (momentum >= 70) return "Aufwärts";
  if (momentum <= 35) return "Abwärts";
  return "Seitwärts";
}

function assetSparkline(item: AssetSummary, quote: Quote) {
  return [
    { symbol: item.asset.symbol, range: "1D" as const, timestamp: quote.asOf, time: "", open: quote.price - quote.change * 1.4, high: quote.price, low: quote.price - Math.abs(quote.change) * 1.8, close: quote.price - quote.change, volume: 1 },
    { symbol: item.asset.symbol, range: "1D" as const, timestamp: quote.asOf, time: "", open: quote.price - quote.change, high: quote.price + Math.abs(quote.change) * 0.6, low: quote.price - Math.abs(quote.change), close: quote.price - quote.change / 2, volume: 1 },
    { symbol: item.asset.symbol, range: "1D" as const, timestamp: quote.asOf, time: "", open: quote.price - quote.change / 2, high: quote.price + Math.abs(quote.change) * 0.8, low: quote.price - Math.abs(quote.change) * 0.4, close: quote.price, volume: 1 }
  ];
}

export function MarketTerminalDashboard({ data, liveQuotes }: { data: DashboardData; liveQuotes: Record<string, NormalizedQuote> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const assets = useMemo(() => uniqueAssets(data), [data]);
  const watchlistSymbols = useMemo(() => new Set(data.watchlist.map((item) => item.asset.symbol)), [data.watchlist]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets
      .filter((item) => {
        if (filter === "watchlist" && !watchlistSymbols.has(item.asset.symbol)) return false;
        if (filter !== "all" && filter !== "watchlist" && item.asset.type !== filter) return false;
        if (!normalizedQuery) return true;
        return `${item.asset.symbol} ${item.asset.name} ${item.asset.sector}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        const quoteA = mergeLiveQuote(a.quote, liveQuotes[a.asset.symbol]);
        const quoteB = mergeLiveQuote(b.quote, liveQuotes[b.asset.symbol]);

        if (sortKey === "symbol") return a.asset.symbol.localeCompare(b.asset.symbol);
        if (sortKey === "price") return quoteB.price - quoteA.price;
        if (sortKey === "volume") return quoteB.volume - quoteA.volume;
        if (sortKey === "score") return b.scores.total - a.scores.total;
        return quoteB.changePercent - quoteA.changePercent;
      });
  }, [assets, filter, liveQuotes, query, sortKey, watchlistSymbols]);

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Alle" },
    { key: "watchlist", label: "Watchlist" },
    { key: "stock", label: "Aktien" },
    { key: "etf", label: "ETFs" },
    { key: "crypto", label: "Krypto" },
    { key: "index", label: "Indizes" },
    { key: "forex", label: "Forex" }
  ];

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "change", label: "%" },
    { key: "volume", label: "Volumen" },
    { key: "score", label: "Score" },
    { key: "price", label: "Preis" },
    { key: "symbol", label: "Symbol" }
  ];

  return (
    <section className="space-y-4 rounded-[2rem] border border-stroke bg-[linear-gradient(145deg,rgba(14,20,32,0.94),rgba(5,8,14,0.96))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan">Live Market Terminal</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">Realtime-Kursübersicht</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Aktien, ETFs, Krypto, Indizes und Forex sind provider-normalisiert. Wenn kein echter Feed aktiv ist, bleibt jeder Kurs sichtbar als Mock markiert.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[31rem]">
          <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
            <div className="flex items-center gap-2 text-profit">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs font-semibold">Top Gewinner</p>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold">{data.gainers[0]?.asset.symbol ?? "n/a"}</p>
          </div>
          <div className="rounded-2xl border border-loss/25 bg-loss/10 p-3">
            <div className="flex items-center gap-2 text-loss">
              <TrendingDown className="h-4 w-4" />
              <p className="text-xs font-semibold">Top Verlierer</p>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold">{data.losers[0]?.asset.symbol ?? "n/a"}</p>
          </div>
          <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3">
            <div className="flex items-center gap-2 text-amber">
              <Flame className="h-4 w-4" />
              <p className="text-xs font-semibold">Most Active</p>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold">{data.mostActive[0]?.asset.symbol ?? "n/a"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Asset suchen</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Symbol, Name oder Thema suchen"
            className="h-12 w-full rounded-2xl border border-stroke bg-coal pl-10 pr-3 text-sm text-mist outline-none transition placeholder:text-muted focus:border-cyan/60"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Assetliste filtern">
          {filterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              aria-label={`Filter ${item.label} anwenden`}
              onClick={() => setFilter(item.key)}
              className={`h-12 rounded-2xl border px-3 text-sm font-semibold transition ${
                filter === item.key ? "border-cyan/50 bg-cyan/12 text-cyan" : "border-stroke bg-panel text-muted hover:text-mist"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-stroke bg-panel/60 p-2" role="group" aria-label="Assetliste sortieren">
        <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-muted" />
        {sortOptions.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={sortKey === item.key}
            aria-label={`Nach ${item.label} sortieren`}
            onClick={() => setSortKey(item.key)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              sortKey === item.key ? "bg-profit/12 text-profit" : "text-muted hover:bg-panel2 hover:text-mist"
            }`}
          >
            Sortieren: {item.label}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {filteredAssets.length} Assets werden angezeigt.
      </p>

      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_1.1fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted lg:grid">
          <span>Asset</span>
          <span>Preis</span>
          <span>%</span>
          <span>Volumen</span>
          <span>Trend</span>
          <span>Datenstatus</span>
        </div>
        <div className="divide-y divide-stroke">
          {filteredAssets.map((item) => {
            const quote = mergeLiveQuote(item.quote, liveQuotes[item.asset.symbol]);
            const positive = quote.changePercent >= 0;

            return (
              <Link
                href={`/assets/${encodeURIComponent(item.asset.symbol)}`}
                key={item.asset.symbol}
                className="grid gap-3 bg-panel/55 px-4 py-4 transition hover:bg-panel2 lg:grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_1.1fr] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-lg font-semibold text-mist">{item.asset.symbol}</p>
                    <span className="rounded-md bg-coal px-2 py-1 text-[10px] uppercase tracking-wide text-muted">{item.asset.type}</span>
                    <span className={`rounded-md px-2 py-1 text-[10px] ${scoreTone(item.scores.total)}`}>{scoreLabel(item.scores.total)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{item.asset.name}</p>
                  <div className="mt-2 max-w-[14rem]">
                    <Sparkline candles={assetSparkline(item, quote)} positive={positive} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted lg:hidden">Preis</p>
                  <p className="font-mono text-xl font-semibold">{formatCurrency(quote.price, item.asset.currency)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Bid/Ask{" "}
                    {quote.bid !== undefined && quote.ask !== undefined
                      ? `${formatCurrency(quote.bid, item.asset.currency)} / ${formatCurrency(quote.ask, item.asset.currency)}`
                      : "nicht geliefert"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted lg:hidden">Bewegung</p>
                  <p className={`font-mono text-lg font-semibold ${positive ? "text-profit" : "text-loss"}`}>{formatPercent(quote.changePercent)}</p>
                  <p className="text-xs text-muted">{formatCurrency(quote.change, item.asset.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted lg:hidden">Volumen</p>
                  <p className="font-mono text-sm font-semibold">{formatCompact(quote.volume)}</p>
                  <p className="text-xs text-muted">
                    Spread {quote.spread !== undefined ? formatCurrency(quote.spread, item.asset.currency) : "nicht geliefert"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted lg:hidden">Trend</p>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-cyan" />
                    <p className="font-semibold">{trendLabel(item)}</p>
                  </div>
                  <p className="text-xs text-muted">Score {item.scores.total}/100</p>
                </div>
                <MarketDataStatus quote={quote} compact />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-panel/70 p-4">
          <p className="text-sm font-semibold text-mist">Trending Assets</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.trendingAssets.map((item) => (
              <Link key={item.asset.symbol} href={`/assets/${item.asset.symbol}`} className="rounded-xl border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm text-cyan">
                {item.asset.symbol} {formatPercent(item.quote.changePercent)}
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stroke bg-panel/70 p-4">
          <p className="text-sm font-semibold text-mist">Heatmap vorbereitet</p>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {assets.slice(0, 10).map((item) => {
              const quote = mergeLiveQuote(item.quote, liveQuotes[item.asset.symbol]);
              return (
                <div
                  key={item.asset.symbol}
                  className={`rounded-lg px-2 py-3 text-center text-[11px] font-semibold ${quote.changePercent >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"}`}
                >
                  {item.asset.symbol}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
