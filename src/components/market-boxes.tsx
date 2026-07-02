import Link from "next/link";
import { memo, useMemo } from "react";
import { Brain, Briefcase, Flame, Newspaper, Star, TrendingDown, TrendingUp } from "lucide-react";
import { DataQualityNotice } from "@/components/data-quality-indicator";
import { DataQualityBadge, MiniSparkline, PriceChangeLabel, RealtimePrice, quoteFromSummary } from "@/components/live-market-widgets";
import { formatCompact, formatCurrency, formatPercent, riskTone } from "@/lib/scoring";
import type { AssetSummary, DashboardData, NewsItem, NormalizedQuote } from "@/lib/types";

function tinyCandles(item: AssetSummary, liveQuote?: NormalizedQuote) {
  const quote = quoteFromSummary(item, liveQuote);
  const move = Math.max(Math.abs(quote.change), quote.price * 0.004);

  return [0, 1, 2, 3, 4].map((step) => {
    const close = quote.price - quote.change + (quote.change / 4) * step + Math.cos(step * 1.1) * move * 0.1;
    return {
      symbol: item.asset.symbol,
      range: "1D" as const,
      timestamp: quote.asOf,
      time: "",
      open: close - move * 0.1,
      high: close + move * 0.18,
      low: close - move * 0.18,
      close,
      volume: quote.volume / 5
    };
  });
}

const RankedRow = memo(function RankedRow({ item, rank, liveQuote }: { item: AssetSummary; rank: number; liveQuote?: NormalizedQuote }) {
  const quote = quoteFromSummary(item, liveQuote);
  const positive = quote.changePercent >= 0;
  const sparklineCandles = useMemo(() => tinyCandles(item, liveQuote), [item, liveQuote]);

  return (
    <Link href={`/assets/${encodeURIComponent(item.asset.symbol)}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border border-stroke bg-panel/68 p-3 transition hover:border-cyan/40 hover:bg-panel2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-coal font-mono text-xs text-muted">{rank}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono font-semibold text-mist">{item.asset.symbol}</p>
          <DataQualityBadge quality={quote.quality} marketStatus={quote.marketStatus} />
        </div>
        <p className="truncate text-xs text-muted">{item.asset.name}</p>
        <p className="mt-1 text-[11px] text-muted">Volumen {formatCompact(quote.volume)}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">{formatCurrency(quote.price, item.asset.currency)}</p>
        <PriceChangeLabel change={quote.change} changePercent={quote.changePercent} currency={item.asset.currency} />
        <div className="mt-1 w-20">
          <MiniSparkline candles={sparklineCandles} positive={positive} />
        </div>
      </div>
    </Link>
  );
});

export function TopMoversCard({
  title,
  items,
  liveQuotes,
  direction
}: {
  title: string;
  items: AssetSummary[];
  liveQuotes: Record<string, NormalizedQuote>;
  direction: "up" | "down";
}) {
  const Icon = direction === "up" ? TrendingUp : TrendingDown;

  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={direction === "up" ? "h-5 w-5 text-profit" : "h-5 w-5 text-loss"} />
        <h3 className="font-semibold text-mist">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <RankedRow key={item.asset.symbol} item={item} rank={index + 1} liveQuote={liveQuotes[item.asset.symbol]} />
        ))}
      </div>
    </section>
  );
}

export function MostActiveCard({ items, liveQuotes }: { items: AssetSummary[]; liveQuotes: Record<string, NormalizedQuote> }) {
  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-5 w-5 text-amber" />
        <h3 className="font-semibold text-mist">Most Active</h3>
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <RankedRow key={item.asset.symbol} item={item} rank={index + 1} liveQuote={liveQuotes[item.asset.symbol]} />
        ))}
      </div>
    </section>
  );
}

export function TrendingAssetsCard({ items, liveQuotes }: { items: AssetSummary[]; liveQuotes: Record<string, NormalizedQuote> }) {
  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-5 w-5 text-cyan" />
        <h3 className="font-semibold text-mist">Trending Assets</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {items.slice(0, 6).map((item) => {
          const quote = quoteFromSummary(item, liveQuotes[item.asset.symbol]);

          return (
            <Link key={item.asset.symbol} href={`/assets/${encodeURIComponent(item.asset.symbol)}`} className="rounded-2xl border border-stroke bg-panel/68 p-3 transition hover:border-cyan/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-semibold text-mist">{item.asset.symbol}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">{item.asset.type}</p>
                </div>
                <p className={quote.changePercent >= 0 ? "font-mono text-profit" : "font-mono text-loss"}>{formatPercent(quote.changePercent)}</p>
              </div>
              <p className="mt-2 text-xs text-muted">Trendindikator: {item.scores.trend}/100 · Risiko {item.aiRisk}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function MarketNewsCard({ news }: { news: NewsItem[] }) {
  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-cyan" />
        <h3 className="font-semibold text-mist">News-Terminal</h3>
      </div>
      <div className="space-y-3">
        {news.slice(0, 5).map((item) => {
          const isMock = item.source.toLowerCase().includes("mock") || item.url === "#";

          return (
            <article key={item.id} className="rounded-2xl border border-stroke bg-panel/68 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-mist">{item.title}</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.sentiment === "positive" ? "bg-profit/10 text-profit" : item.sentiment === "negative" ? "bg-loss/10 text-loss" : "bg-amber/10 text-amber"}`}>
                  {item.sentiment}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{item.source} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.publishedAt))} · Relevanz {item.relevance}/100</p>
              <p className="mt-2 text-xs leading-5 text-muted">{item.summary}</p>
              {isMock ? (
                <p className="mt-2 rounded-xl border border-amber/25 bg-amber/10 px-2 py-1 text-[11px] text-amber">
                  MOCK-News: Demo, nicht als echte Nachricht verwenden.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function WatchlistTable({ items, liveQuotes }: { items: AssetSummary[]; liveQuotes: Record<string, NormalizedQuote> }) {
  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <h3 className="font-semibold text-mist">Watchlist</h3>
      <div className="mt-3 overflow-hidden rounded-2xl border border-stroke">
        {items.length ? items.map((item) => {
          const quote = quoteFromSummary(item, liveQuotes[item.asset.symbol]);

          return (
            <Link key={item.asset.symbol} href={`/assets/${encodeURIComponent(item.asset.symbol)}`} className="grid gap-2 border-b border-stroke bg-panel/55 p-3 last:border-b-0 sm:grid-cols-[1.1fr_0.8fr_0.7fr_0.9fr] sm:items-center">
              <div>
                <p className="font-mono font-semibold text-mist">{item.asset.symbol}</p>
                <p className="truncate text-xs text-muted">{item.asset.name}</p>
              </div>
              <RealtimePrice price={quote.price} currency={item.asset.currency} />
              <PriceChangeLabel change={quote.change} changePercent={quote.changePercent} currency={item.asset.currency} />
              <DataQualityBadge quality={quote.quality} marketStatus={quote.marketStatus} />
            </Link>
          );
        }) : (
          <div className="bg-panel/55 p-5" role="status">
            <p className="font-semibold text-mist">Noch keine Watchlist-Einträge.</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Füge ein Symbol hinzu oder melde dich mit Supabase an. Ohne echte Kursdaten werden keine Signale abgeleitet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function MarketOverviewCard({ data }: { data: DashboardData }) {
  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <h3 className="font-semibold text-mist">Marktübersicht</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {data.marketOverview.map((item) => (
          <div key={item.label} className="rounded-2xl border border-stroke bg-panel/68 p-3">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-mist">{item.value}</p>
            <p className={item.changePercent >= 0 ? "text-sm text-profit" : "text-sm text-loss"}>{formatPercent(item.changePercent)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PortfolioSnapshotCard({ data }: { data: DashboardData }) {
  const snapshot = useMemo(
    () =>
      data.watchlist.reduce(
        (current, item) => ({
          total: current.total + item.quote.price * 3,
          dayPnl: current.dayPnl + item.quote.change * 3,
          riskSum: current.riskSum + item.scores.risk
        }),
        { total: 0, dayPnl: 0, riskSum: 0 }
      ),
    [data.watchlist]
  );
  const total = snapshot.total;
  const dayPnl = snapshot.dayPnl;
  const risk = Math.round(snapshot.riskSum / Math.max(1, data.watchlist.length));

  return (
    <section className="rounded-[1.65rem] border border-stroke bg-coal/76 p-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-profit" />
        <h3 className="font-semibold text-mist">Portfolio-Snapshot</h3>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-panel/68 p-3">
          <p className="text-xs text-muted">Simulierter Wert</p>
          <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(total, "USD")}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-panel/68 p-3">
          <p className="text-xs text-muted">Tages-P/L</p>
          <p className={dayPnl >= 0 ? "mt-1 font-mono text-lg font-semibold text-profit" : "mt-1 font-mono text-lg font-semibold text-loss"}>{formatCurrency(dayPnl, "USD")}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-panel/68 p-3">
          <p className="text-xs text-muted">Risiko-Score</p>
          <p className={`mt-1 font-mono text-lg font-semibold ${riskTone(risk >= 75 ? "niedrig" : risk >= 45 ? "mittel" : "hoch")}`}>{risk}/100</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">Snapshot nutzt Watchlist-Positionen als Beispiel, echte Portfolio-Transaktionen bleiben im Portfolio-Modul.</p>
      <div className="mt-3">
        <DataQualityNotice
          quality="mock"
          marketStatus="unknown"
          provider="StockPilot Portfolio Demo"
          updatedAt={data.watchlist[0]?.quote.asOf}
          title="Portfolio-Snapshot"
        />
      </div>
    </section>
  );
}

export function AIInsightCard({ data }: { data: DashboardData }) {
  return (
    <section className="rounded-[1.65rem] border border-cyan/25 bg-cyan/10 p-4">
      <div className="flex items-center gap-2 text-cyan">
        <Brain className="h-5 w-5" />
        <h3 className="font-semibold">KI-Marktzusammenfassung</h3>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-mist">{data.aiSentiment.score}/100</p>
      <p className="mt-2 text-sm leading-6 text-muted">{data.aiSentiment.summary}</p>
      <p className="mt-3 text-xs leading-5 text-amber">Modellbasierte Einschätzung, keine Garantie und keine Anlageberatung.</p>
    </section>
  );
}
