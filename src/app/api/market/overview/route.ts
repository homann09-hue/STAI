import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";

const ttlMs = 15000;
const staleTtlMs = 180000;
const MAX_ARRAY_ITEMS = 80;
const MAX_OBJECT_KEYS = 80;
const MAX_STRING_LENGTH = 1000;
const MAX_SANITIZE_DEPTH = 5;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function sanitizeDashboardPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.replace(CONTROL_CHARS, "").trim().slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeDashboardPayload(item, depth + 1));
  }
  if (typeof value !== "object") return null;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "__proto__" && key !== "constructor" && key !== "prototype")
      .slice(0, MAX_OBJECT_KEYS)
      .map(([key, item]) => [key.replace(CONTROL_CHARS, "").slice(0, 120), sanitizeDashboardPayload(item, depth + 1)])
  );
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const provider = getMarketDataProvider();
  const generatedAt = new Date().toISOString();

  try {
    const result = await withCacheFallback(`dashboard:${provider.providerId}`, () => provider.getDashboard(), {
      staleTtlMs,
      ttlMs
    });
    const payload = sanitizeDashboardPayload(result.value);

    return jsonOk({
      ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
      metadata: {
        provider: provider.providerName,
        quality: provider.quality,
        streamMode: provider.streamMode,
        fromCache: result.fromCache,
        cacheStoredAt: result.cacheStoredAt,
        cacheWarning: result.warning,
        generatedAt,
        ttlMs,
        staleTtlMs,
        disclaimer:
          "Marktübersichten können realtime, delayed, cached oder mock sein. Einzelne Cards dürfen nicht als Anlageberatung verstanden werden."
      }
    }, {
      headers: {
        "Cache-Control": "s-maxage=15, stale-while-revalidate=180",
        "X-Content-Type-Options": "nosniff",
        "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
        "X-StockPilot-Provider": provider.providerName,
        "X-StockPilot-Data-Quality": result.fromCache ? "cached" : provider.quality
      }
    });
  } catch {
    return jsonOk({
      marketStatus: "unavailable",
      overview: [],
      watchlist: [],
      gainers: [],
      losers: [],
      mostActive: [],
      trending: [],
      news: [],
      metadata: {
        provider: provider.providerName,
        quality: "unavailable",
        streamMode: provider.streamMode,
        fromCache: false,
        cacheStoredAt: null,
        cacheWarning: "Marktübersicht konnte nicht geladen werden.",
        generatedAt,
        ttlMs,
        staleTtlMs,
        disclaimer:
          "Marktübersichten können realtime, delayed, cached oder mock sein. Einzelne Cards dürfen nicht als Anlageberatung verstanden werden."
      }
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-StockPilot-Cache": "error",
        "X-StockPilot-Provider": provider.providerName,
        "X-StockPilot-Data-Quality": "unavailable"
      }
    });
  }
}
