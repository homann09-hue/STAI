import "server-only";
import { buildMacroOverview, buildMacroReading, type MacroOverview, type MacroReading } from "@/lib/macro/analysis";
import { parseSdmxCsv } from "@/lib/macro/sdmx";
import { macroSeriesCatalog, macroSeriesUrl, type MacroSeriesDefinition } from "@/lib/macro/series";
import { fetchBoundedProviderText } from "@/lib/providers/http-json";
import { logEvent } from "@/lib/observability";

/**
 * Makrodaten vom EZB Data Portal.
 *
 * Die EZB ist hier die erste Quelle, weil sie ohne Schlüssel, ohne Tarif und
 * ohne Börsenlizenz auskommt. Damit ist die Makroanalyse der erste Bereich der
 * Zieldefinition, der nicht an einer externen Freigabe hängt.
 *
 * Eine Reihe, die nicht antwortet, fehlt sichtbar. Sie wird nicht durch einen
 * Demowert, den letzten bekannten Wert oder eine Schätzung ersetzt — eine
 * falsche Inflationsrate fällt niemandem auf und ist deshalb besonders
 * gefährlich.
 */

const OBSERVATIONS_PER_SERIES = 24;
const SERIES_TIMEOUT_MS = 5_000;

async function loadSeries(definition: MacroSeriesDefinition, now: Date): Promise<MacroReading | null> {
  try {
    const { text, latencyMs } = await fetchBoundedProviderText(
      macroSeriesUrl(definition, OBSERVATIONS_PER_SERIES),
      "ECB",
      { timeoutMs: SERIES_TIMEOUT_MS, maxBytes: 512_000 }
    );

    const parsed = parseSdmxCsv(text);

    if (parsed.rejectedRows > 0) {
      logEvent("warn", "macro.rows_rejected", {
        seriesId: definition.id,
        rejectedRows: parsed.rejectedRows,
        accepted: parsed.observations.length
      });
    }

    const reading = buildMacroReading(definition, parsed.observations, now);

    if (!reading) {
      logEvent("warn", "macro.series_empty", { seriesId: definition.id });
      return null;
    }

    logEvent("info", "macro.series_loaded", {
      seriesId: definition.id,
      asOf: reading.asOf,
      ageDays: reading.ageDays,
      freshness: reading.freshness,
      latencyMs
    });

    return reading;
  } catch (error) {
    logEvent("warn", "macro.series_failed", {
      seriesId: definition.id,
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

/**
 * Holt alle Reihen des Katalogs.
 *
 * Bewusst parallel und mit `allSettled`-Verhalten je Reihe: eine
 * nicht erreichbare Serie darf die übrigen nicht mitreißen. Das Ergebnis nennt
 * ausdrücklich, welche Reihen fehlen.
 */
export async function getMacroOverview(now: Date = new Date()): Promise<MacroOverview> {
  const results = await Promise.all(
    macroSeriesCatalog.map(async (definition) => ({
      definition,
      reading: await loadSeries(definition, now)
    }))
  );

  const readings = results
    .map((result) => result.reading)
    .filter((reading): reading is MacroReading => reading !== null);

  const unavailableSeries = results
    .filter((result) => result.reading === null)
    .map((result) => result.definition.id);

  if (unavailableSeries.length > 0) {
    logEvent("warn", "macro.partial_overview", {
      available: readings.length,
      unavailable: unavailableSeries.length
    });
  }

  return buildMacroOverview(readings, unavailableSeries);
}
