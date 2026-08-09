/**
 * Begrenzung der Kurshistorie nach Tarif.
 *
 * §4 nennt `historicalDataYears` als Tariflimit: Free 1 Jahr, Pro 10, Premium
 * 20. Definiert war es seit Langem — **durchgesetzt hat es nichts.**
 *
 * Die Lücke ist durch meine eigene Arbeit größer geworden: seit
 * `price-history.ts` bekommt jeder Abruf 1255 Tageskerzen, also fünf Jahre. Ein
 * Free-Konto sah damit genau dieselbe Historie wie ein Premium-Konto. Nach §90
 * ist ein Limit, das nichts begrenzt, eine Fassade — und wirtschaftlich ist es
 * ein Tarifmerkmal, das nichts wert ist.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

import type { Candle } from "@/lib/types";

export type HistoryLimitResult<T> = {
  candles: T[];
  /** Ob überhaupt gekürzt wurde. */
  truncated: boolean;
  /** Wie viele Kerzen entfernt wurden. */
  removed: number;
  years: number;
  /**
   * Was der Nutzer erfährt.
   *
   * Eine stillschweigend gekürzte Reihe wäre schlimmer als gar keine: der
   * Nutzer würde einen Chart über ein Jahr für die gesamte Historie halten und
   * daraus Schlüsse ziehen.
   */
  note: string | null;
};

/**
 * Kürzt eine Kerzenreihe auf die im Tarif erlaubten Jahre.
 *
 * Gekürzt wird **vorne**, nicht hinten: die jüngsten Kerzen bleiben. Andersherum
 * bekäme ein Free-Konto das älteste Jahr statt des aktuellen — technisch
 * dieselbe Menge, praktisch wertlos.
 *
 * `years <= 0` gilt als „keine Begrenzung". Ein Tarif mit null Jahren Historie
 * wäre kein Tarif, sondern ein Fehler in der Konfiguration, und dann ist es
 * besser, nichts abzuschneiden als alles.
 */
export function limitHistoryByYears<T extends Pick<Candle, "timestamp">>(
  candles: readonly T[],
  years: number,
  now = new Date()
): HistoryLimitResult<T> {
  if (!Number.isFinite(years) || years <= 0) {
    return { candles: [...candles], truncated: false, removed: 0, years, note: null };
  }

  const cutoff = now.getTime() - years * 365.25 * 86_400_000;
  const kept = candles.filter((candle) => {
    const timestamp = new Date(candle.timestamp).getTime();
    // Eine Kerze ohne lesbares Datum wird behalten. Sie wegzuwerfen waere eine
    // Entscheidung ueber Daten, die man nicht beurteilen kann.
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });

  const removed = candles.length - kept.length;

  return {
    candles: kept,
    truncated: removed > 0,
    removed,
    years,
    note:
      removed > 0
        ? `Der Tarif umfasst ${years} ${years === 1 ? "Jahr" : "Jahre"} Kurshistorie. ${removed} ältere Kerzen wurden nicht geladen.`
        : null
  };
}

/**
 * Kürzt alle Zeitfenster auf einmal.
 *
 * Wichtig für die Anzeige: das Fenster „5J" enthält nach der Kürzung bei einem
 * Free-Konto nur noch ein Jahr. Es deshalb auszublenden wäre falsch — der
 * Nutzer soll sehen, dass es das Fenster gibt und was ihm fehlt.
 */
export function limitCandleRanges<T extends Pick<Candle, "timestamp">>(
  ranges: Record<string, T[]>,
  years: number,
  now = new Date()
): { ranges: Record<string, T[]>; truncated: boolean; note: string | null } {
  let truncated = false;
  let maxRemoved = 0;

  const limited = Object.fromEntries(
    Object.entries(ranges).map(([key, candles]) => {
      const result = limitHistoryByYears(candles, years, now);
      if (result.truncated) {
        truncated = true;
        maxRemoved = Math.max(maxRemoved, result.removed);
      }
      return [key, result.candles];
    })
  ) as Record<string, T[]>;

  return {
    ranges: limited,
    truncated,
    note: truncated
      ? `Der Tarif umfasst ${years} ${years === 1 ? "Jahr" : "Jahre"} Kurshistorie. Längere Zeitfenster zeigen deshalb weniger, als ihr Name verspricht.`
      : null
  };
}
