import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import {
  recordInstrumentQuoteStatus,
  resolveInstrumentIdentityBySymbol
} from "@/lib/instrument-master-store";
import { resolveAssetUnavailability } from "@/lib/asset-availability";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";
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

  const requestedCanonicalId = new URL(request.url).searchParams.get("canonicalId")?.trim() || null;
  if (requestedCanonicalId && !isCanonicalInstrumentId(requestedCanonicalId)) {
    return jsonError("Ungültige Instrument-ID.", 400);
  }

  const identityResolution = await resolveInstrumentIdentityBySymbol(
    parsed.data,
    requestedCanonicalId,
  );
  if (identityResolution.status === "ambiguous") {
    const unavailability = resolveAssetUnavailability({
      symbol: parsed.data,
      known: null,
      ambiguous: identityResolution.candidates,
    });
    return Response.json(
      {
        error: unavailability.message,
        reason: unavailability.reason,
        listings: unavailability.alternatives,
        remediation: unavailability.remediation,
      },
      {
        status: unavailability.httpStatus,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-StockPilot-Unavailable-Reason": unavailability.reason,
        },
      },
    );
  }
  if (requestedCanonicalId && identityResolution.status !== "resolved") {
    return jsonError("Das gewählte Listing ist nicht mehr eindeutig verfügbar.", 409);
  }
  const known = identityResolution.status === "resolved" ? identityResolution.identity : null;

  const provider = getMarketDataProvider();
  const ttlMs = 5000;
  const staleTtlMs = 120000;
  const result = await withCacheFallback(
    `asset:${known?.canonicalId ?? `unresolved:${parsed.data}`}`,
    () => provider.getAsset(parsed.data),
    { policy: "asset_detail", ttlMs, staleTtlMs }
  );
  const detail = result.value;

  // Kursverfuegbarkeit ist im aktiven Tarif nicht vorhersagbar (SPY liefert,
  // QQQ nicht). Jeder echte Abruf ist deshalb eine Messung, die im Instrument
  // Master festgehalten wird, damit die Suche spaeter nicht mehr raten muss.
  // Bewusst nicht abgewartet: das Ergebnis der Route haengt nicht davon ab.
  if (!result.fromCache && known) {
    void recordInstrumentQuoteStatus(
      known.canonicalId,
      detail && detail.quote.quality !== "unavailable" ? "available" : "restricted"
    );
  }

  if (!detail) {
    // Ein pauschales 404 waere bei einem unvollstaendigen, suchgetriebenen
    // Instrument Master unbelegt. Die Antwort trennt Tarifsperre,
    // Providerfehler und noch nicht verifizierte Identitaet.
    const unavailability = resolveAssetUnavailability({ symbol: parsed.data, known });

    return Response.json(
      {
        error: unavailability.message,
        reason: unavailability.reason,
        identity: unavailability.identity,
        remediation: unavailability.remediation
      },
      {
        status: unavailability.httpStatus,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-StockPilot-Unavailable-Reason": unavailability.reason
        }
      }
    );
  }

  return jsonOk({
      ...detail,
      identity: known,
      metadata: {
      provider: provider.providerName,
      quality: result.fromCache ? "cached" : detail.quote.quality,
      streamMode: provider.streamMode,
      fromCache: result.fromCache,
      cacheStoredAt: result.cacheStoredAt,
      cacheWarning: result.warning,
      ttlMs,
      staleTtlMs,
      disclaimer:
        "Asset-Details können realtime, delayed, cached oder mock sein. Scores und KI-Texte sind keine Anlageberatung."
    }
  }, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-Provider": provider.providerName,
      "X-StockPilot-Data-Quality": result.fromCache ? "cached" : detail.quote.quality
    }
  });
}
