import { z } from "zod";

import { buildNormalizedQuote } from "@/lib/canonical-quote";
import type { MarketDataQuality, NormalizedQuote } from "@/lib/types";

const numericText = z.string().trim().min(1).max(80);
const tickerSchema = z
  .object({
    product_id: z.string().trim().min(3).max(40),
    price: numericText,
    volume_24_h: numericText.optional(),
    low_24_h: numericText.optional(),
    high_24_h: numericText.optional(),
    low_52_w: numericText.optional(),
    high_52_w: numericText.optional(),
    price_percent_chg_24_h: numericText.optional(),
    best_bid: numericText.optional(),
    best_bid_quantity: numericText.optional(),
    best_ask: numericText.optional(),
    best_ask_quantity: numericText.optional(),
  })
  .passthrough();

const tickerEnvelopeSchema = z
  .object({
    channel: z.literal("ticker"),
    timestamp: z.string().trim().min(1).max(80),
    sequence_num: z.number().int().nonnegative(),
    events: z.array(
      z
        .object({
          type: z.enum(["snapshot", "update"]),
          tickers: z.array(tickerSchema).max(250),
        })
        .passthrough(),
    ).max(20),
  })
  .passthrough();

export interface CoinbaseTickerBatch {
  sequenceNumber: number;
  quotes: NormalizedQuote[];
}

export interface CoinbaseTickerNormalizationOptions {
  quality?: MarketDataQuality;
  receivedAt?: Date;
  resolveSymbol?: (providerSymbol: string) => string;
}

function finiteNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: string | undefined): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegative(value: string | undefined): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function normalizeCoinbaseProductId(value: string): string {
  return value.trim().toUpperCase().replace("/", "-");
}

export function isCoinbaseStreamProductSupported(value: string): boolean {
  const product = normalizeCoinbaseProductId(value);
  if (!/^[A-Z0-9]{2,20}-[A-Z0-9]{2,10}$/.test(product)) return false;
  if (!product.endsWith("-USDC")) return true;
  return product === "USDT-USDC" || product === "EURC-USDC";
}

export function normalizeCoinbaseTickerMessage(
  input: unknown,
  options: CoinbaseTickerNormalizationOptions = {},
): CoinbaseTickerBatch | null {
  const parsed = tickerEnvelopeSchema.safeParse(input);
  if (!parsed.success) return null;

  const receivedAt = options.receivedAt ?? new Date();
  const providerTime = new Date(parsed.data.timestamp);
  if (!Number.isFinite(providerTime.getTime())) return null;
  const latencyMs = Math.max(0, receivedAt.getTime() - providerTime.getTime());
  const quality = options.quality ?? "near_realtime";
  const quotes = parsed.data.events.flatMap((event) =>
    event.tickers.flatMap((ticker): NormalizedQuote[] => {
      const providerSymbol = normalizeCoinbaseProductId(ticker.product_id);
      if (!isCoinbaseStreamProductSupported(providerSymbol)) return [];
      const price = positive(ticker.price);
      if (price === null) return [];
      const symbol = normalizeCoinbaseProductId(
        options.resolveSymbol?.(providerSymbol) ?? providerSymbol,
      );
      const currency = providerSymbol.split("-").at(-1) ?? "XXX";
      const changePercent = finiteNumber(ticker.price_percent_chg_24_h);
      const denominator =
        changePercent !== null ? 1 + changePercent / 100 : null;
      const previousClose =
        denominator !== null && denominator > 0 ? price / denominator : null;
      const change = previousClose !== null ? price - previousClose : null;

      try {
        return [
          buildNormalizedQuote(
            {
              instrumentId: `crypto:COINBASE:${symbol}:${currency}`,
              symbol,
              assetType: "crypto",
              providerId: "coinbase",
              providerSymbol,
              venue: "COINBASE",
              currency,
              last: price,
              bid: positive(ticker.best_bid),
              bidSize: nonNegative(ticker.best_bid_quantity),
              ask: positive(ticker.best_ask),
              askSize: nonNegative(ticker.best_ask_quantity),
              volume: nonNegative(ticker.volume_24_h),
              high: positive(ticker.high_24_h),
              low: positive(ticker.low_24_h),
              fiftyTwoWeekHigh: positive(ticker.high_52_w),
              fiftyTwoWeekLow: positive(ticker.low_52_w),
              previousClose,
              change,
              changePercent,
              marketStatus: "open",
              marketSession: "REGULAR",
              eventTimestamp: providerTime.toISOString(),
              providerTimestamp: providerTime.toISOString(),
              receivedTimestamp: receivedAt.toISOString(),
              provider: "Coinbase Advanced Trade",
              quality,
              latencyMs,
            },
            { now: receivedAt },
          ),
        ];
      } catch {
        return [];
      }
    }),
  );

  return { sequenceNumber: parsed.data.sequence_num, quotes };
}
