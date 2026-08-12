import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { buildForecastLedgerResponse } from "@/lib/forecast-ledger";
import { persistForecastLedgerResponse } from "@/lib/forecast-ledger-store";
import { withCacheFallback } from "@/lib/provider-cache";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { validateSymbol } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { symbol } = await params;
  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungültiges Symbol.", 400);
  }

  const provider = getMarketDataProvider();
  const ttlMs = 30000;
  const staleTtlMs = 300000;
  const result = await withCacheFallback(
    `forecast-ledger:${parsed.data}`,
    async () => {
      const detail = await provider.getAsset(parsed.data);
      return detail ? buildForecastLedgerResponse(detail) : null;
    },
    { policy: "forecast", ttlMs, staleTtlMs }
  );

  if (!result.value) {
    return jsonError("Forecast nicht verfügbar, weil das Asset nicht gefunden wurde.", 404);
  }

  const persistence = result.fromCache
    ? {
        status: "skipped" as const,
        forecastId: null,
        outcomeId: null,
        reason: "Persistenz wurde für Cache-Fallback-Antworten übersprungen, um doppelte Schreiblast zu vermeiden."
      }
    : await persistForecastLedgerResponse(result.value);

  return jsonOk(
    {
      ...result.value,
      metadata: {
        provider: provider.providerName,
        streamMode: provider.streamMode,
        cache: {
          fromCache: result.fromCache,
          storedAt: result.cacheStoredAt,
          warning: result.warning,
          ttlMs,
          staleTtlMs
        },
        persistence,
        status:
          result.value.ledgerEntry.promotionGate === "approved"
            ? "forecast_ready"
            : result.value.ledgerEntry.promotionGate === "restricted"
              ? "forecast_limited"
              : "forecast_blocked",
        disclaimer:
          "Keine Anlageberatung. Forecasts sind probabilistische Research-Schaetzungen mit Daten-Cutoff, Modellversion und spaeterer Outcome-Auswertung."
      }
    },
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
        "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
        "X-StockPilot-Provider": provider.providerName,
        "X-StockPilot-Forecast-Gate": result.value.ledgerEntry.promotionGate,
        "X-StockPilot-Model-Version": result.value.ledgerEntry.modelVersion,
        "X-StockPilot-Data-Cutoff": result.value.ledgerEntry.dataCutoff
      }
    }
  );
}
