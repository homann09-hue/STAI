/**
 * Auswahl der Instrumente, für die regelmäßig Prognosen erzeugt werden.
 *
 * Reine Funktionen ohne I/O.
 *
 * Abgrenzung, die wichtig ist: Das hier ist **nicht** das Instrumentuniversum.
 * Es ist die Antwort auf die Frage „für welche Instrumente erzeugen wir
 * derzeit Prognosen". Diese Menge ist legitim begrenzt — durch Kosten,
 * Rate Limits und vor allem dadurch, welche Symbole der aktive Tarif überhaupt
 * mit Kursen versorgt.
 *
 * Ein Instrument ohne belegbaren Kurs bekommt keine Prognose. Sonst entstünden
 * Ledger-Einträge, die später zwangsläufig als `insufficient_data` enden und
 * die Bewertungsquote drücken, ohne je eine Aussage zu erlauben.
 */

export type QuoteStatus = "unknown" | "available" | "restricted" | "error";

export interface CoverageCandidate {
  symbol: string;
  quoteStatus: QuoteStatus;
  /** Wie oft der Provider das Instrument bestätigt hat. Näherung für Relevanz. */
  confirmationCount: number;
  /** ISO-Zeitpunkt der letzten erzeugten Prognose, falls vorhanden. */
  lastForecastAt?: string | null;
}

export interface CoverageSelection {
  symbols: string[];
  /** Warum die Auswahl so ausfällt — gehört in die Antwort des Jobs. */
  reason: string;
  skipped: {
    notEntitled: number;
    unverified: number;
    recentlyForecast: number;
    overBudget: number;
  };
  usedBootstrap: boolean;
}

/**
 * Bootstrap-Liste für den Zustand, in dem der Instrument Master noch leer ist.
 *
 * Diese Symbole wurden am 2026-08-07 einzeln gegen `stable/quote` geprüft und
 * lieferten HTTP 200. Sie sind ausdrücklich **kein** Universum und keine
 * Empfehlung, sondern ein Startpunkt, damit überhaupt Prognosen entstehen
 * können. Sobald der Master gefüllt ist, greift die Liste nicht mehr.
 */
export const VERIFIED_BOOTSTRAP_SYMBOLS = ["AAPL", "MSFT", "SPY", "BTCUSD", "EURUSD", "GCUSD", "^GSPC"] as const;

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MIN_HOURS_BETWEEN_FORECASTS = 20;

function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return (now.getTime() - then) / (60 * 60 * 1000);
}

/**
 * Wählt die Instrumente für den nächsten Prognoselauf.
 *
 * Reihenfolge der Filter ist bewusst so:
 *   1. Kursberechtigung — ohne Kurs keine bewertbare Prognose.
 *   2. Frische — kein zweiter Eintrag am selben Tag, das bläht den Ledger auf,
 *      ohne die Aussagekraft zu erhöhen.
 *   3. Budget — harte Obergrenze pro Lauf als Kostenschutz.
 */
export function selectForecastCoverage(
  candidates: CoverageCandidate[],
  options: {
    batchSize?: number;
    minHoursBetweenForecasts?: number;
    now?: Date;
    allowBootstrap?: boolean;
  } = {}
): CoverageSelection {
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? DEFAULT_BATCH_SIZE));
  const minHours = options.minHoursBetweenForecasts ?? DEFAULT_MIN_HOURS_BETWEEN_FORECASTS;
  const now = options.now ?? new Date();
  const allowBootstrap = options.allowBootstrap ?? true;

  const skipped = { notEntitled: 0, unverified: 0, recentlyForecast: 0, overBudget: 0 };

  if (candidates.length === 0) {
    if (!allowBootstrap) {
      return {
        symbols: [],
        reason: "Instrument Master ist leer und Bootstrap ist deaktiviert.",
        skipped,
        usedBootstrap: false
      };
    }

    return {
      symbols: [...VERIFIED_BOOTSTRAP_SYMBOLS].slice(0, batchSize),
      reason:
        "Instrument Master enthält noch keine Instrumente mit bestätigter Kursverfügbarkeit. Es wird die geprüfte Bootstrap-Liste verwendet, damit überhaupt Prognosen entstehen. Das ist kein Universum.",
      skipped,
      usedBootstrap: true
    };
  }

  const seen = new Set<string>();
  const eligible: CoverageCandidate[] = [];

  for (const candidate of candidates) {
    const symbol = candidate.symbol.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);

    if (candidate.quoteStatus === "restricted") {
      skipped.notEntitled += 1;
      continue;
    }

    // `unknown` und `error` heissen: wir wissen es nicht. Eine Prognose darauf
    // waere eine Wette auf Datenverfuegbarkeit, keine Analyse.
    if (candidate.quoteStatus !== "available") {
      skipped.unverified += 1;
      continue;
    }

    const age = hoursSince(candidate.lastForecastAt, now);
    if (age !== null && age < minHours) {
      skipped.recentlyForecast += 1;
      continue;
    }

    eligible.push({ ...candidate, symbol });
  }

  // Häufiger bestätigte Instrumente zuerst: sie sind eher relevant und ihre
  // Daten sind belastbarer.
  eligible.sort((a, b) => b.confirmationCount - a.confirmationCount || a.symbol.localeCompare(b.symbol));

  if (eligible.length > batchSize) {
    skipped.overBudget = eligible.length - batchSize;
  }

  const symbols = eligible.slice(0, batchSize).map((candidate) => candidate.symbol);

  if (symbols.length === 0) {
    return {
      symbols: [],
      reason:
        skipped.notEntitled > 0 || skipped.unverified > 0
          ? "Kein Instrument mit bestätigter Kursverfügbarkeit. Ohne Kurs entsteht keine bewertbare Prognose."
          : "Alle infrage kommenden Instrumente haben bereits eine aktuelle Prognose.",
      skipped,
      usedBootstrap: false
    };
  }

  return {
    symbols,
    reason: `${symbols.length} Instrument(e) mit bestätigter Kursverfügbarkeit ausgewählt.`,
    skipped,
    usedBootstrap: false
  };
}
