/**
 * Kursverfuegbarkeit im aktiven Providertarif.
 *
 * Gemessen gegen FMP am 2026-08-07:
 *   AAPL, MSFT (NASDAQ)      -> 200
 *   SPY (AMEX)               -> 200
 *   EURUSD, GCUSD, BTCUSD    -> 200
 *   QQQ (NASDAQ ETF)         -> 402
 *   SPYM, SPYX (AMEX ETF)    -> 402
 *   BTCS (NASDAQ Aktie)      -> 402
 *   AAPL.DE, APC.F (Europa)  -> 402
 *
 * Daraus folgt: weder Assetklasse noch Handelsplatz erlauben eine Vorhersage.
 * SPY ist frei, QQQ nicht; AAPL ist frei, BTCS nicht. FMP gated auf Symbolebene.
 * Jede Heuristik waere hier falsche Sicherheit, deshalb wird der Status gemessen
 * und gespeichert statt abgeleitet.
 */

export type QuoteStatus = "unknown" | "available" | "restricted" | "error";

/**
 * Uebersetzt eine Provider-Antwort in einen Kursstatus.
 *
 * `402` ist bei FMP die Tarifsperre und damit ein dauerhafter Zustand.
 * `403` ist ein abgeschalteter oder nicht freigegebener Endpunkt, ebenfalls
 * dauerhaft. Alles andere ist ein Betriebsfehler und darf nicht als dauerhafte
 * Sperre gespeichert werden, weil sonst ein einmaliger Timeout ein Instrument
 * faelschlich als gesperrt markiert.
 */
export function quoteStatusFromHttpStatus(status: number): QuoteStatus {
  if (status === 200) return "available";
  if (status === 402 || status === 403) return "restricted";
  return "error";
}

export function quoteStatusFromProviderError(error: unknown): QuoteStatus {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/\b(402|403)\b/.test(message)) return "restricted";
  return "error";
}

/**
 * Ob ein Status eine belastbare Aussage ueber Kursverfuegbarkeit erlaubt.
 * `unknown` und `error` duerfen in der UI niemals als "verfuegbar" erscheinen.
 */
export function isQuoteStatusConfirmed(status: QuoteStatus) {
  return status === "available" || status === "restricted";
}

/**
 * Ob ein erneuter Messversuch sinnvoll ist. Eine Tarifsperre aendert sich nur
 * durch einen Tarifwechsel, ein Betriebsfehler dagegen jederzeit.
 */
export function shouldRecheckQuoteStatus(status: QuoteStatus, checkedAt: string | null, now = new Date()) {
  if (status === "unknown" || status === "error") return true;
  if (!checkedAt) return true;

  const checked = new Date(checkedAt).getTime();
  if (!Number.isFinite(checked)) return true;

  // Tarifsperren werden seltener nachgeprueft als bestaetigte Verfuegbarkeit,
  // weil ein Tarifwechsel selten ist.
  const maxAgeMs = status === "restricted" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return now.getTime() - checked > maxAgeMs;
}
