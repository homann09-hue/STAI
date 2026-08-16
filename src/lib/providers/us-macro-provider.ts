import "server-only";
import {
  buildMacroOverview,
  buildMacroReading,
  type MacroOverview,
  type MacroOverviewShape,
  type MacroReading
} from "@/lib/macro/analysis";
import { fetchFredSeries } from "@/lib/macro/fred-client";
import { fredSeriesCatalog, type FredSeriesDefinition } from "@/lib/macro/fred";
import { derivationCaveat, licenceCaveat, toMacroDataLifecycle, toMacroReadingSource } from "@/lib/macro/fred-reading";
import { derivePolicyRatePath, type PolicyRatePath } from "@/lib/macro/policy-rate-history";
import { logEvent } from "@/lib/observability";

/**
 * US-Makrolage über FRED.
 *
 * Das Gegenstück zu `macro-provider.ts`, der den Euroraum bei der EZB holt.
 * Beide Quellen kommen ohne Schlüssel und ohne Börsenlizenz aus — die
 * Makroanalyse hängt damit als einziger größerer Bereich an keiner
 * kostenpflichtigen Freigabe.
 *
 * Bewusst **nicht** mit dem Euroraum in eine Liste geworfen: eine Inflationsrate
 * von 2,1 neben einer von 2,8, ohne dass danebensteht, welche wo gilt, ist
 * schlimmer als gar keine. §22 verlangt, dass unterschiedliche Bezugsräume
 * nicht unbemerkt vermischt werden.
 */

const OBSERVATIONS_PER_SERIES = 24;
/**
 * Der Leitzins braucht ein laengeres Fenster: aus 24 Beobachtungen laesst sich
 * keine Entscheidungshistorie ableiten. 800 Handelstage decken gut drei Jahre
 * ab -- am 2026-08-09 gemessen sechs Zinsschritte.
 */
const POLICY_RATE_OBSERVATIONS = 800;
const POLICY_RATE_SERIES_ID = "us_policy_rate";

const usShape: MacroOverviewShape = {
  shortEndId: "us_yield_3m",
  longEndId: "us_yield_10y",
  disclaimer:
    "US-Makrodaten stammen von FRED (Federal Reserve Bank of St. Louis) und beschreiben den jeweils genannten Stichtag, nicht den heutigen Tag. Keine Anlageberatung."
};

type SeriesLoad = { reading: MacroReading; observations: { period: string; value: number }[] } | null;

async function loadSeries(definition: FredSeriesDefinition, now: Date, observationCount: number): Promise<SeriesLoad> {
  const { observations, note, mode, revisionDataAvailable } = await fetchFredSeries(definition, observationCount);

  if (observations.length === 0) {
    logEvent("warn", "us_macro.series_empty", { seriesId: definition.id, note });
    return null;
  }

  const reading = buildMacroReading(toMacroReadingSource(definition), observations, now);
  if (!reading) {
    logEvent("warn", "us_macro.series_unreadable", { seriesId: definition.id });
    return null;
  }

  // Ableitung und Lizenzstand gehoeren an die einzelne Reihe. Am Gesamtblock
  // stuenden sie entweder ueberall falsch oder nirgends.
  const extra = [
    derivationCaveat(definition),
    licenceCaveat(definition),
    mode === "csv_fallback"
      ? "Veröffentlichungs- und Revisionsdaten sind im offiziellen FRED-CSV-Fallback nicht verfügbar."
      : revisionDataAvailable
        ? null
        : "FRED lieferte für diese Reihe keine Erstveröffentlichung; ein Revisionsvergleich ist nicht möglich."
  ].filter(
    (entry): entry is string => entry !== null
  );

  logEvent("info", "us_macro.series_loaded", {
    seriesId: definition.id,
    asOf: reading.asOf,
    ageDays: reading.ageDays,
    freshness: reading.freshness
  });

  return {
    reading: {
      ...reading,
      dataLifecycle: toMacroDataLifecycle(observations, definition),
      caveats: [...reading.caveats, ...extra]
    },
    observations
  };
}

/**
 * Holt alle US-Reihen.
 *
 * Wie beim Euroraum: parallel, und eine nicht erreichbare Reihe reißt die
 * übrigen nicht mit. Was fehlt, wird benannt statt ersetzt — eine erfundene
 * Inflationsrate fällt niemandem auf und ist deshalb besonders gefährlich.
 */
export async function getUsMacroOverview(now: Date = new Date()): Promise<MacroOverview> {
  const results: Array<{ definition: FredSeriesDefinition; load: SeriesLoad }> = [];
  // Pro Reihe sind mit API-Schlüssel zwei Abrufe nötig. Kleine Batches halten
  // Lastspitzen und Provider-Rate-Limits auch bei kaltem Cache kontrollierbar.
  for (let offset = 0; offset < fredSeriesCatalog.length; offset += 4) {
    const batch = fredSeriesCatalog.slice(offset, offset + 4);
    results.push(...await Promise.all(
      batch.map(async (definition) => ({
        definition,
        load: await loadSeries(
          definition,
          now,
          definition.id === POLICY_RATE_SERIES_ID ? POLICY_RATE_OBSERVATIONS : OBSERVATIONS_PER_SERIES
        )
      }))
    ));
  }

  const readings = results
    .map((result) => result.load?.reading)
    .filter((reading): reading is MacroReading => reading !== undefined);

  const unavailableSeries = results
    .filter((result) => result.load === null)
    .map((result) => result.definition.id);

  const policyRateLoad = results.find((result) => result.definition.id === POLICY_RATE_SERIES_ID)?.load;
  const policyRatePath: PolicyRatePath | null = policyRateLoad
    ? derivePolicyRatePath(policyRateLoad.observations, now)
    : null;

  if (unavailableSeries.length > 0) {
    logEvent("warn", "us_macro.partial_overview", {
      available: readings.length,
      unavailable: unavailableSeries.length
    });
  }

  return buildMacroOverview(readings, unavailableSeries, policyRatePath, usShape);
}
