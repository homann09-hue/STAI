import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { getMacroOverview } from "@/lib/providers/macro-provider";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";
import { getUsMacroOverview } from "@/lib/providers/us-macro-provider";
import { trackProviderUsage } from "@/lib/cost/usage-recorder";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Makrolage — Euroraum oder USA.
 *
 * Bewusst ohne Tarifprüfung: Leitzins, Inflation und Renditen sind öffentliche
 * Statistik und gehören zu dem, was auch ein Free-Konto sehen soll. Die Antwort
 * darf deshalb im geteilten Cache liegen — sie ist für jeden Aufrufer identisch
 * und enthält nichts Persönliches.
 *
 * Die Zwischenspeicherung ist zugleich Rücksicht auf zwei kostenlose öffentliche
 * Quellen: eine Handvoll Reihen pro Abruf, nicht pro Besucher.
 *
 * **Die beiden Räume werden getrennt ausgeliefert.** Sie in eine Liste zu
 * werfen wäre bequem und irreführend: eine Inflationsrate von 2,1 neben einer
 * von 2,8, ohne dass danebensteht, welche wo gilt, ist schlimmer als gar keine.
 */

type RegionConfig = {
  cacheKey: string;
  label: string;
  provider: string;
  attribution: string;
  usageProvider: "ecb" | "fred";
  load: () => Promise<import("@/lib/macro/analysis").MacroOverview>;
};

const regions: Record<string, RegionConfig> = {
  euro_area: {
    cacheKey: "macro:overview:euro-area",
    label: "Euroraum",
    provider: "ECB Data Portal",
    attribution: "Quelle: Europäische Zentralbank, EZB Data Portal",
    usageProvider: "ecb",
    load: () => getMacroOverview()
  },
  us: {
    cacheKey: "macro:overview:us",
    label: "USA",
    provider: "FRED (Federal Reserve Bank of St. Louis)",
    // FRED verlangt die Quellenangabe. Die Ursprungsbehoerde je Reihe steht
    // zusaetzlich an der Reihe selbst -- der CPI kommt vom
    // US-Arbeitsministerium, nicht von der Fed in St. Louis.
    attribution: "Quelle: FRED, Federal Reserve Bank of St. Louis",
    usageProvider: "fred",
    load: () => getUsMacroOverview()
  }
};

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const requested = new URL(request.url).searchParams.get("region") ?? "euro_area";
  const region = regions[requested];

  if (!region) {
    return jsonError(
      `Unbekannter Wirtschaftsraum "${requested}". Verfügbar: ${Object.keys(regions).join(", ")}.`,
      400
    );
  }

  const routing = resolveProviderRoute({
    capability: "macro",
    assetClass: "macro",
    preferredProvider: region.usageProvider,
  });
  if (!routing.providers.includes(region.usageProvider)) {
    const reason = routing.rejected.find(
      (entry) => entry.providerId === region.usageProvider,
    )?.detail;
    return jsonError(
      `Makrodaten sind für die externe Anzeige nicht freigeschaltet. ${reason ?? "Kein zulässiger Provider verfügbar."}`,
      503,
    );
  }

  const costControls = getCostControls();

  try {
    const result = await withCacheFallback(region.cacheKey, region.load, {
      policy: "macro",
      ttlMs: costControls.fundamentalsTtlMs,
      staleTtlMs: costControls.fundamentalsStaleTtlMs
    });

    // Ohne Konto zaehlbar, aber keinem Tarif zurechenbar. Beide Quellen kosten
    // nichts -- gezaehlt wird trotzdem, damit die Trefferquote stimmt.
    trackProviderUsage({ userId: null, plan: "free" }, region.usageProvider, result.fromCache);

    const overview = result.value;

    return jsonOk(
      {
        ...overview,
        metadata: {
          region: region.label,
          provider: region.provider,
          attribution: region.attribution,
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
          "X-StockPilot-Macro-Region": requested,
          "X-StockPilot-Macro-Series": `${overview.readings.length}/${overview.readings.length + overview.unavailableSeries.length}`
        }
      }
    );
  } catch (error) {
    logEvent("error", "macro.overview_failed", {
      region: requested,
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonError("Makrodaten sind derzeit nicht abrufbar. Es werden bewusst keine Ersatzwerte gezeigt.", 503);
  }
}
