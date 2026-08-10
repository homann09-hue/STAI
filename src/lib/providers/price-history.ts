/**
 * Echte Kurshistorie.
 *
 * Hier stand vorher nichts — stattdessen erzeugte `candlesFromQuote` aus einem
 * einzelnen Kurs 32 Kerzen mit einer Sinusfunktion:
 *
 * ```
 * close = Kurs − Bewegung × (1 − Fortschritt) + sin(index × 0,7) × Volatilität × 0,08
 * ```
 *
 * Aus diesen Kerzen las die Risiko-Engine Momentum und Volumentrend und
 * erzeugte daraus Befunde mit Belegen. Das war ein §61-Verstoß mit
 * Folgewirkung: nicht nur erfundene Daten, sondern erfundene Daten, die als
 * Analyseergebnis auftraten.
 *
 * Gemessen am 2026-08-08: FMP liefert im vorhandenen Tarif 1255 Tageskerzen für
 * AAPL und 1826 für BTCUSD — genug für SMA 200 und einen echten MACD. Für ETFs
 * antwortet dieselbe Route mit HTTP 402. Deshalb gilt hier dieselbe Regel wie
 * überall: **keine Historie ist keine erfundene Historie.**
 */

import { limitHistoryByYears } from "@/lib/billing/history-limit";
import {
  assessHistoricalDataIntegrity,
  historicalPriceBasisLabel,
  type HistoricalDataIntegrity
} from "@/lib/analysis/history-integrity";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { chartRanges, type Candle, type TimeRange } from "@/lib/types";

export type HistoryResult = {
  candles: Candle[];
  /** Warum die Historie so aussieht. Gehört in die Herkunftsanzeige. */
  note: string;
  /** Der Anbieter, der geantwortet hat — oder null, wenn keiner konnte. */
  provider: string | null;
  /** Maschinenlesbare Aussage darüber, welche Preisbasis tatsächlich vorliegt. */
  integrity: HistoricalDataIntegrity | null;
};

export const NO_HISTORY: HistoryResult = {
  candles: [],
  note: "Keine Kurshistorie verfügbar.",
  provider: null,
  integrity: null
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseNumber(value: unknown): number | null {
  if (isNumber(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Übersetzt die FMP-Antwort in Kerzen.
 *
 * Rein und ohne Netz, damit die Auswertung ohne Schlüssel prüfbar bleibt.
 *
 * Verworfen wird jede Zeile, der ein Pflichtfeld fehlt oder deren Schlusskurs
 * nicht positiv ist. Bewusst kein Auffüllen aus Nachbarwerten: eine
 * interpolierte Kerze ist genau die Erfindung, die diese Datei ersetzt.
 */
export function parseFmpDailyHistory(symbol: string, raw: unknown): Candle[] {
  const rows = Array.isArray(raw) ? raw : [];

  const candles = rows.flatMap((row): Candle[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;

    const date = typeof entry.date === "string" ? entry.date : null;
    const close = parseNumber(entry.close);
    if (!date || close === null || close <= 0) return [];

    const timestamp = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp.getTime())) return [];

    // Fehlt ein Feld, wird der Schlusskurs eingesetzt -- das ist keine
    // Schaetzung, sondern die einzige Lesart einer Kerze ohne Spanne.
    const open = parseNumber(entry.open) ?? close;
    const high = parseNumber(entry.high) ?? Math.max(open, close);
    const low = parseNumber(entry.low) ?? Math.min(open, close);
    const volume = parseNumber(entry.volume) ?? 0;
    const adjustedCloseCandidate = parseNumber(entry.adjClose ?? entry.adjustedClose);
    const adjustedClose =
      adjustedCloseCandidate !== null && adjustedCloseCandidate > 0
        ? adjustedCloseCandidate
        : undefined;

    return [
      {
        symbol,
        range: "MAX",
        timestamp: timestamp.toISOString(),
        time: date.slice(0, 10),
        open,
        high: Math.max(high, open, close),
        low: Math.max(0, Math.min(low, open, close)),
        close,
        ...(adjustedClose === undefined ? {} : { adjustedClose }),
        volume: Math.max(0, volume)
      }
    ];
  });

  // FMP liefert absteigend. Alle Indikatoren erwarten aufsteigende Reihen --
  // ein RSI auf einer rueckwaerts gelesenen Reihe waere exakt gespiegelt und
  // damit falsch, ohne falsch auszusehen.
  return candles.sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

/** Wie viele Kalendertage ein Zeitfenster zurückreicht. */
const windowDays: Partial<Record<TimeRange, number>> = {
  "5D": 7,
  "1W": 7,
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 366,
  "5Y": 1827
};

/**
 * Schneidet die Tagesreihe in die Zeitfenster der Oberfläche.
 *
 * **`1D` bleibt leer.** Tagesschlusskurse enthalten keinen Intraday-Verlauf;
 * eine Ein-Punkt-Reihe als Tageschart auszugeben wäre eine Behauptung über
 * einen Verlauf, der nicht vorliegt.
 */
export function sliceHistoryRanges(daily: readonly Candle[], now = new Date()): Record<TimeRange, Candle[]> {
  const nowMs = now.getTime();
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);

  const entries = chartRanges.map((range): [TimeRange, Candle[]] => {
    if (range === "1D") return [range, []];

    const from =
      range === "MAX"
        ? Number.NEGATIVE_INFINITY
        : range === "YTD"
          ? yearStart
          : nowMs - (windowDays[range] ?? 31) * 86_400_000;

    const window = daily
      .filter((candle) => new Date(candle.timestamp).getTime() >= from)
      .map((candle) => ({ ...candle, range }));

    return [range, window];
  });

  return Object.fromEntries(entries) as Record<TimeRange, Candle[]>;
}

/**
 * Wendet das Tariflimit auf eine bereits geholte Reihe an.
 *
 * Getrennt vom Abruf, damit der Zwischenspeicher die ungekürzte Reihe halten
 * kann: die Grenze gehört zum Aufrufer, nicht zum Symbol.
 */
function applyPlanLimit(result: HistoryResult, limitYears: number | undefined, now: Date): HistoryResult {
  if (limitYears === undefined || result.candles.length === 0) return result;

  const limited = limitHistoryByYears(result.candles, limitYears, now);
  if (!limited.truncated) return result;

  return {
    ...result,
    candles: limited.candles,
    // Der Hinweis wird angehaengt statt ersetzt: die Herkunft bleibt sichtbar,
    // die Kuerzung kommt dazu.
    note: `${result.note} ${limited.note}`.trim()
  };
}

type CacheEntry = { result: HistoryResult; storedAtMs: number };

const historyCache = new Map<string, CacheEntry>();
// Tagesschlusskurse aendern sich einmal taeglich. Eine Stunde ist reichlich
// konservativ und haelt die Zahl der Abrufe klein -- die Antwort ist mit ueber
// 1000 Kerzen die teuerste im ganzen Provider-Pfad.
const HISTORY_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

export function clearHistoryCache() {
  historyCache.clear();
}

/**
 * Holt die Tageshistorie beim konfigurierten Anbieter.
 *
 * Wirft nicht. Jeder Fehlerfall — fehlender Schlüssel, HTTP 402 für ETFs,
 * Zeitüberschreitung — endet in einer leeren Reihe mit Begründung. Ein
 * Analysepfad darf an fehlender Historie nicht abbrechen, aber er darf sie
 * eben auch nicht ersetzen.
 */
export async function fetchDailyHistory(
  symbol: string,
  now = new Date(),
  /**
   * Wie viele Jahre der Tarif umfasst (§4 `historicalDataYears`).
   *
   * Die Kürzung passiert **hier** und nicht in der Anzeige: sonst läge die
   * vollständige Reihe im ausgelieferten HTML, und ein Free-Konto käme mit dem
   * Entwicklerwerkzeug an die Premium-Historie. §4 verlangt, dass der Client
   * nie über den Tarif entscheidet.
   */
  limitYears?: number
): Promise<HistoryResult> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return NO_HISTORY;

  // Der Zwischenspeicher haelt die **ungekuerzte** Reihe. Die Kuerzung haengt
  // am Tarif des Aufrufers und darf deshalb nicht mit zwischengespeichert
  // werden -- sonst bekaeme der naechste Nutzer die Grenze des vorigen.
  const cached = historyCache.get(normalized);
  if (cached && now.getTime() - cached.storedAtMs < HISTORY_TTL_MS) {
    return applyPlanLimit(cached.result, limitYears, now);
  }

  const token = process.env.FMP_API_KEY;
  if (!token) {
    return { ...NO_HISTORY, note: "Keine Kurshistorie: FMP_API_KEY ist nicht gesetzt." };
  }

  const base = process.env.FMP_API_BASE_URL ?? "https://financialmodelingprep.com/stable";
  const url = new URL(`${base}/historical-price-eod/full`);
  url.searchParams.set("symbol", normalized);
  url.searchParams.set("apikey", token);

  let result: HistoryResult;

  try {
    const { data } = await fetchBoundedProviderJson<unknown>(url, "FMP History", {
      timeoutMs: 9000,
      // Ueber 1200 Tageskerzen mit vollem OHLCV. Das Standardlimit von 1,5 MB
      // reicht, wird hier aber ausdruecklich benannt statt stillschweigend
      // angenommen.
      maxBytes: 2_500_000
    });

    const candles = parseFmpDailyHistory(normalized, data);
    const integrity = assessHistoricalDataIntegrity(candles, new Date().toISOString());

    result = candles.length
      ? {
          candles,
          note: `${candles.length} Tageskerzen von Financial Modeling Prep. Preisbasis: ${historicalPriceBasisLabel(integrity.priceBasis)}.`,
          provider: "Financial Modeling Prep",
          integrity
        }
      : { ...NO_HISTORY, note: "Der Anbieter lieferte keine verwertbaren Tageskerzen." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    result = {
      ...NO_HISTORY,
      // Der Grund wird durchgereicht statt geschluckt. HTTP 402 heisst bei FMP
      // "im Tarif nicht enthalten" -- das trifft ETFs und ist keine Stoerung,
      // sondern eine Tarifgrenze, die der Nutzer erfahren soll.
      note: message.includes("402")
        ? "Keine Kurshistorie: Der FMP-Tarif deckt dieses Instrument nicht ab."
        : `Keine Kurshistorie: ${message}.`
    };
  }

  if (historyCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = historyCache.keys().next().value;
    if (oldest !== undefined) historyCache.delete(oldest);
  }
  historyCache.set(normalized, { result, storedAtMs: now.getTime() });

  return applyPlanLimit(result, limitYears, now);
}
