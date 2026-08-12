import type { NormalizedQuote, Quote } from "@/lib/types";

export function mergeLiveQuote(
  base: Quote,
  liveQuote?: NormalizedQuote,
): Quote {
  if (!liveQuote) return base;

  return {
    ...base,
    price: liveQuote.price,
    change: liveQuote.change,
    changePercent: liveQuote.changePercent,
    dayHigh: liveQuote.high ?? base.dayHigh,
    dayLow: liveQuote.low ?? base.dayLow,
    volume: liveQuote.volume ?? base.volume,
    delayedByMinutes:
      liveQuote.reportedDelaySeconds !== null
        ? Math.ceil(liveQuote.reportedDelaySeconds / 60)
        : liveQuote.quality === "delayed"
          ? base.delayedByMinutes
          : null,
    asOf: liveQuote.timestamp,
    bid: liveQuote.bid ?? undefined,
    ask: liveQuote.ask ?? undefined,
    spread: liveQuote.spread ?? undefined,
    open: liveQuote.open ?? base.open,
    previousClose: liveQuote.previousClose ?? base.previousClose,
    fiftyTwoWeekHigh: liveQuote.fiftyTwoWeekHigh ?? base.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: liveQuote.fiftyTwoWeekLow ?? base.fiftyTwoWeekLow,
    provider: liveQuote.provider,
    quality: liveQuote.quality,
    latencyMs: liveQuote.latencyMs ?? undefined,
    marketStatus: liveQuote.marketStatus,
  };
}
