import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { getMacroOverview } from "@/lib/providers/macro-provider";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Makrolage des Euroraums.
 *
 * Bewusst ohne Tarifprüfung: Leitzins, Inflation und Renditen sind öffentliche
 * Statistik der EZB und gehören zu dem, was auch ein Free-Konto sehen soll.
 * Die Antwort darf deshalb im geteilten Cache liegen — sie ist für jeden
 * Aufrufer identisch und enthält nichts Persönliches.
 *
 * Die Zwischenspeicherung ist hier zugleich Rücksicht auf eine kostenlose
 * öffentliche Quelle: fünf Reihen pro Abruf, nicht pro Besucher.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const costControls = getCostControls();

  try {
    const result = await withCacheFallback("macro:overview:euro-area", () => getMacroOverview(), {
      ttlMs: costControls.fundamentalsTtlMs,
      staleTtlMs: costControls.fundamentalsStaleTtlMs
    });

    const overview = result.value;

    return jsonOk(
      {
        ...overview,
        metadata: {
          region: "Euroraum",
          provider: "ECB Data Portal",
          attribution: "Quelle: Europäische Zentralbank, EZB Data Portal",
          fromCache: result.fromCache,
          cacheStoredAt: result.cacheStoredAt,
          cacheWarning: result.warning,
          // Der Abrufzeitpunkt ist nicht der Datenstand. Beides steht
          // getrennt da, weil die Verwechslung genau der Fehler waere, den
          // §22 verbietet.
          fetchedAt: new Date().toISOString()
        }
      },
      {
        headers: {
          ...cacheControlHeaders(costControls.fundamentalsTtlMs, costControls.fundamentalsStaleTtlMs),
          "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
          "X-StockPilot-Macro-Series": `${overview.readings.length}/${overview.readings.length + overview.unavailableSeries.length}`
        }
      }
    );
  } catch (error) {
    logEvent("error", "macro.overview_failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonError("Makrodaten sind derzeit nicht abrufbar. Es werden bewusst keine Ersatzwerte gezeigt.", 503);
  }
}
