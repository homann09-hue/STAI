import "server-only";
import {
  fredApiSeriesUrl,
  fredCitation,
  fredSeriesUrl,
  mergeFredObservationVintages,
  parseFredApiObservations,
  parseFredCsv,
  toMonthlyChange,
  type FredObservation,
  type FredSeriesDefinition
} from "@/lib/macro/fred";
import { fetchBoundedProviderJson, fetchBoundedProviderText } from "@/lib/providers/http-json";

export type FredFetchMode = "api" | "csv_fallback";

export type FredFetchResult = {
  observations: FredObservation[];
  note: string;
  mode: FredFetchMode;
  revisionDataAvailable: boolean;
};

function fredApiKey() {
  return process.env.FRED_API_KEY?.trim() || null;
}

async function fetchFromApi(
  series: FredSeriesDefinition,
  observations: number,
  apiKey: string
): Promise<FredFetchResult> {
  const requested = Math.max(2, observations + (series.reportAsChange ? 1 : 0));
  const [current, initial] = await Promise.all([
    fetchBoundedProviderJson<FredObservation[]>(fredApiSeriesUrl(series, apiKey, 1, requested), "FRED", {
      timeoutMs: 9000,
      maxBytes: 2_000_000,
      parseJson: parseFredApiObservations
    }),
    fetchBoundedProviderJson<FredObservation[]>(fredApiSeriesUrl(series, apiKey, 4, requested), "FRED", {
      timeoutMs: 9000,
      maxBytes: 2_000_000,
      parseJson: parseFredApiObservations
    })
  ]);

  const merged = mergeFredObservationVintages(current.data, initial.data);
  const values = series.reportAsChange ? toMonthlyChange(merged) : merged;
  return {
    observations: values.slice(-observations),
    note: fredCitation(series),
    mode: "api",
    revisionDataAvailable: initial.data.length > 0
  };
}

async function fetchFromCsv(series: FredSeriesDefinition, observations: number): Promise<FredFetchResult> {
  const { text } = await fetchBoundedProviderText(fredSeriesUrl(series), "FRED", {
    timeoutMs: 9000,
    accept: "text/csv",
    maxBytes: 1_500_000
  });
  const requested = Math.max(2, observations + (series.reportAsChange ? 1 : 0));
  const parsed = parseFredCsv(text).slice(-requested);
  const values = series.reportAsChange ? toMonthlyChange(parsed) : parsed;
  return {
    observations: values.slice(-observations),
    note: `${fredCitation(series)}. CSV-Fallback ohne Veröffentlichungs- und Revisionshistorie.`,
    mode: "csv_fallback",
    revisionDataAvailable: false
  };
}

/**
 * Nutzt mit Schlüssel die offizielle FRED-API samt Erstveröffentlichung und
 * Revisionsvergleich. Ohne Schlüssel oder bei API-Störung bleibt der offizielle
 * CSV-Export verfügbar, wird aber ausdrücklich nicht als revisionsfähig ausgegeben.
 */
export async function fetchFredSeries(
  series: FredSeriesDefinition,
  observations = 400
): Promise<FredFetchResult> {
  const bounded = Math.max(2, Math.min(observations, 2_000));
  const apiKey = fredApiKey();

  if (apiKey) {
    try {
      const result = await fetchFromApi(series, bounded, apiKey);
      if (result.observations.length > 0) return result;
    } catch {
      // Der CSV-Pfad bleibt eine offizielle Quelle, hat aber keine Vintage-Daten.
    }
  }

  try {
    const result = await fetchFromCsv(series, bounded);
    return result.observations.length > 0
      ? result
      : { ...result, note: `Keine verwertbaren Beobachtungen. ${result.note}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    return {
      observations: [],
      note: `Reihe nicht abrufbar: ${message}.`,
      mode: "csv_fallback",
      revisionDataAvailable: false
    };
  }
}
