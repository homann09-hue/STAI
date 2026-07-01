import { Clock3, Database, Radio, ShieldAlert, WifiOff, Zap } from "lucide-react";
import { getDataQualityDisplay } from "@/lib/data-quality";
import type { MarketDataQuality, MarketStatus, NormalizedQuote, Quote } from "@/lib/types";

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
  const display = getDataQualityDisplay({
    quality: quote.quality,
    marketStatus: quote.marketStatus,
    delayedByMinutes: delayedBy(quote)
  });
  const timestamp = timestampOf(quote);
  const formattedTimestamp = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(timestamp));

  return (
    <div className={`rounded-md border px-3 py-2 ${display.tone}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{display.label}</p>
      </div>
      {!compact ? (
        <div className="mt-2 space-y-1 text-[11px] leading-4 text-muted">
          <p>Provider: {quote.provider}</p>
          <p>Letzte Aktualisierung: {formattedTimestamp}</p>
          <p>Latenz: {quote.latencyMs !== undefined ? `${quote.latencyMs} ms` : "n/a"}</p>
          {display.warning ? <p className="text-amber">{display.warning}</p> : null}
        </div>
      ) : (
        <p className="mt-1 truncate text-[11px] text-muted">
          {quote.provider} / {formattedTimestamp} / {quote.latencyMs !== undefined ? `${quote.latencyMs} ms` : "n/a"}
        </p>
      )}
    </div>
  );
}
