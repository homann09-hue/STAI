import Link from "next/link";
import { Clock3, Database, Radio, RefreshCw, WifiOff, Zap } from "lucide-react";
import { MarketDataStatus } from "@/components/market-data-status";
import { formatCurrency, formatPercent } from "@/lib/scoring";
import type { AssetSummary, Candle, MarketConnectionStatus, MarketDataQuality, MarketStatus, NormalizedQuote, Quote, RefreshInterval, RefreshMode } from "@/lib/types";

export function quoteFromSummary(item: AssetSummary, liveQuote?: NormalizedQuote): Quote {
  if (!liveQuote) return item.quote;

  return {
    ...item.quote,
    price: liveQuote.price,
    change: liveQuote.change,
    changePercent: liveQuote.changePercent,
    dayHigh: liveQuote.high ?? item.quote.dayHigh,
    dayLow: liveQuote.low ?? item.quote.dayLow,
    volume: liveQuote.volume ?? item.quote.volume,
    delayedByMinutes: liveQuote.quality === "delayed" ? Math.max(item.quote.delayedByMinutes, 15) : 0,
    asOf: liveQuote.timestamp,
    bid: liveQuote.bid,
    ask: liveQuote.ask,
    spread: liveQuote.spread,
    open: liveQuote.open ?? item.quote.open,
    previousClose: liveQuote.previousClose ?? item.quote.previousClose,
    fiftyTwoWeekHigh: liveQuote.fiftyTwoWeekHigh ?? item.quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: liveQuote.fiftyTwoWeekLow ?? item.quote.fiftyTwoWeekLow,
    provider: liveQuote.provider,
    quality: liveQuote.quality,
    latencyMs: liveQuote.latencyMs,
    marketStatus: liveQuote.marketStatus
  };
}

function qualityLabel(quality: MarketDataQuality, marketStatus: MarketStatus) {
  if (quality === "mock") return "Mock";
  if (quality === "unavailable") return "Error";
  if (marketStatus === "closed") return "Closed";
  if (quality === "realtime") return "Realtime";
  if (quality === "near_realtime") return "Near";
  if (quality === "delayed") return "Delayed";
  if (quality === "historical") return "Historical";
  return "Unavailable";
}

function badgeTone(quality: MarketDataQuality, marketStatus: MarketStatus) {
  if (quality === "mock" || quality === "unavailable") return "border-loss/35 bg-loss/10 text-loss";
  if (marketStatus === "closed" || quality === "delayed" || quality === "historical") return "border-amber/35 bg-amber/10 text-amber";
  if (quality === "realtime") return "border-profit/35 bg-profit/10 text-profit";
  return "border-cyan/35 bg-cyan/10 text-cyan";
}

export function DataQualityBadge({ quality, marketStatus }: { quality: MarketDataQuality; marketStatus: MarketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${badgeTone(quality, marketStatus)}`}>
      {qualityLabel(quality, marketStatus)}
    </span>
  );
}

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  const label = status === "pre_market" ? "Pre-Market" : status === "after_hours" ? "After-Hours" : status;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stroke bg-coal px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
      <Clock3 className="h-3 w-3" />
      {label}
    </span>
  );
}

export function PriceChangeLabel({ change, changePercent, currency = "USD" }: { change: number; changePercent: number; currency?: string }) {
  const positive = changePercent >= 0;
  return (
    <span className={`font-mono text-sm font-semibold ${positive ? "text-profit" : "text-loss"}`}>
      {positive ? "+" : ""}
      {formatCurrency(change, currency)} · {formatPercent(changePercent)}
    </span>
  );
}

export function RealtimePrice({ price, currency = "USD" }: { price: number; currency?: string }) {
  return <span className="font-mono text-2xl font-semibold tracking-tight text-mist">{formatCurrency(price, currency)}</span>;
}

export function MiniSparkline({ candles, positive }: { candles: Candle[]; positive: boolean }) {
  const width = 150;
  const height = 46;
  const values = candles.length ? candles.map((candle) => candle.close) : [1, 1.02, 1.01];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full overflow-visible" aria-hidden="true">
      <polygon points={area} fill={positive ? "#35d07f" : "#ff5c5c"} opacity="0.12" />
      <polyline points={points} fill="none" stroke={positive ? "#35d07f" : "#ff5c5c"} strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}

function fallbackSparkline(item: AssetSummary, quote: Quote): Candle[] {
  const volatility = Math.max(Math.abs(quote.change), quote.price * 0.004);
  return [0, 1, 2, 3, 4, 5].map((step) => {
    const close = quote.price - quote.change + (quote.change / 5) * step + Math.sin(step * 1.4) * volatility * 0.18;
    return {
      symbol: item.asset.symbol,
      range: "1D",
      timestamp: quote.asOf,
      time: "",
      open: close - volatility * 0.12,
      high: close + volatility * 0.22,
      low: close - volatility * 0.2,
      close,
      volume: quote.volume / 6
    };
  });
}

export function MarketIndexCard({ item, liveQuote }: { item: AssetSummary; liveQuote?: NormalizedQuote }) {
  const quote = quoteFromSummary(item, liveQuote);
  const positive = quote.changePercent >= 0;
  const updated = new Intl.DateTimeFormat("de-DE", { timeStyle: "medium" }).format(new Date(quote.asOf));

  return (
    <Link
      href={`/assets/${encodeURIComponent(item.asset.symbol)}`}
      className="min-w-[17rem] rounded-[1.35rem] border border-stroke bg-panel/78 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition hover:border-cyan/45 hover:bg-panel2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-lg font-semibold text-mist">{item.asset.symbol}</p>
            <DataQualityBadge quality={quote.quality} marketStatus={quote.marketStatus} />
          </div>
          <p className="mt-1 truncate text-xs text-muted">{item.asset.name}</p>
        </div>
        <MarketStatusBadge status={quote.marketStatus} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
        <MiniSparkline candles={fallbackSparkline(item, quote)} positive={positive} />
        <div className="text-right">
          <RealtimePrice price={quote.price} currency={item.asset.currency} />
          <div className="mt-1">
            <PriceChangeLabel change={quote.change} changePercent={quote.changePercent} currency={item.asset.currency} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{quote.provider}</span>
        <span>·</span>
        <span>Updated {updated}</span>
      </div>
    </Link>
  );
}

export function LiveMarketTickerBar({
  items,
  liveQuotes,
  title = "Live / Near-Realtime Marktband"
}: {
  items: AssetSummary[];
  liveQuotes: Record<string, NormalizedQuote>;
  title?: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-stroke bg-coal/80 p-3 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan">{title}</p>
          <p className="mt-1 text-xs text-muted">Realtime nur bei Streaming/Provider-Lizenz. REST-Fallback = Near-Realtime.</p>
        </div>
        <RefreshCw className="h-4 w-4 text-muted" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <MarketIndexCard key={item.asset.symbol} item={item} liveQuote={liveQuotes[item.asset.symbol]} />
        ))}
      </div>
    </section>
  );
}

export function ConnectionBadge({
  status,
  mode,
  intervalMs
}: {
  status: MarketConnectionStatus;
  mode: RefreshMode;
  intervalMs?: RefreshInterval;
}) {
  const Icon = status === "connected" ? Zap : status === "polling" ? Radio : status === "rate_limited" ? Database : status === "offline" ? WifiOff : RefreshCw;
  const tone =
    status === "connected"
      ? "border-profit/35 bg-profit/10 text-profit"
      : status === "polling" || status === "reconnecting"
        ? "border-cyan/35 bg-cyan/10 text-cyan"
        : status === "rate_limited"
          ? "border-amber/35 bg-amber/10 text-amber"
          : "border-loss/35 bg-loss/10 text-loss";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${tone}`}>
      <Icon className="h-4 w-4" />
      {status} · {mode}
      {intervalMs ? ` · ${intervalMs / 1000}s` : ""}
    </span>
  );
}

export { MarketDataStatus };
