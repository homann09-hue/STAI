import { Clock3, Database, Radio, ShieldAlert, WifiOff, Zap } from "lucide-react";
import type { MarketDataQuality, MarketStatus, NormalizedQuote, Quote } from "@/lib/types";

function qualityLabel(quality: MarketDataQuality, marketStatus: MarketStatus, delayedByMinutes?: number) {
  if (quality === "mock") return "Mock Data";
  if (quality === "unavailable") return "Error";
  if (marketStatus === "closed") return "Market Closed";
  if (quality === "realtime") return "Realtime";
  if (quality === "near_realtime") return "Near-Realtime";
  if (quality === "delayed") return `Delayed ${delayedByMinutes && delayedByMinutes > 0 ? delayedByMinutes : 15} min`;
  if (quality === "historical") return "Historical";
  return "Unavailable";
}

function qualityTone(quality: MarketDataQuality, marketStatus: MarketStatus) {
  if (quality === "mock" || quality === "unavailable") return "border-loss/35 bg-loss/10 text-loss";
  if (marketStatus === "closed" || quality === "delayed" || quality === "historical") return "border-amber/35 bg-amber/10 text-amber";
  if (quality === "realtime") return "border-profit/35 bg-profit/10 text-profit";
  return "border-cyan/35 bg-cyan/10 text-cyan";
}

function qualityIcon(quality: MarketDataQuality, marketStatus: MarketStatus) {
  if (quality === "mock") return Database;
  if (quality === "unavailable") return WifiOff;
  if (marketStatus === "closed") return Clock3;
  if (quality === "realtime") return Zap;
  if (quality === "near_realtime") return Radio;
  return ShieldAlert;
}

function timestampOf(quote: Quote | NormalizedQuote) {
  return "timestamp" in quote ? quote.timestamp : quote.asOf;
}

function delayedBy(quote: Quote | NormalizedQuote) {
  return "delayedByMinutes" in quote ? quote.delayedByMinutes : undefined;
}

export function MarketDataStatus({ quote, compact = false }: { quote: Quote | NormalizedQuote; compact?: boolean }) {
  const Icon = qualityIcon(quote.quality, quote.marketStatus);
  const label = qualityLabel(quote.quality, quote.marketStatus, delayedBy(quote));
  const timestamp = timestampOf(quote);
  const formattedTimestamp = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(timestamp));

  return (
    <div className={`rounded-md border px-3 py-2 ${qualityTone(quote.quality, quote.marketStatus)}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      {!compact ? (
        <div className="mt-2 space-y-1 text-[11px] leading-4 text-muted">
          <p>Provider: {quote.provider}</p>
          <p>Last Updated: {formattedTimestamp}</p>
          <p>Latency: {quote.latencyMs !== undefined ? `${quote.latencyMs} ms` : "n/a"}</p>
        </div>
      ) : (
        <p className="mt-1 truncate text-[11px] text-muted">
          {quote.provider} / {formattedTimestamp} / {quote.latencyMs !== undefined ? `${quote.latencyMs} ms` : "n/a"}
        </p>
      )}
    </div>
  );
}
