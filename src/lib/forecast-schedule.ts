/**
 * Zeitplanlogik für die Prognoseerzeugung.
 *
 * Warum das im Code steht und nicht im Cron-Ausdruck: Vercel erlaubt auf dem
 * Hobby-Tarif nur einen Lauf pro Tag, und ein Ausdruck mit höherer Frequenz
 * lässt das Deployment fehlschlagen. Ein Wochentagsfilter wie `0 8 * * 1-5` ist
 * dort riskant. Der Cron läuft deshalb schlicht täglich; ob tatsächlich
 * gearbeitet wird, entscheidet diese Funktion.
 *
 * Zweiter Grund: Auf Hobby ruft Vercel den Job irgendwann innerhalb der
 * angegebenen Stunde auf. Eine im Ausdruck kodierte Reihenfolge wäre ohnehin
 * nicht garantiert.
 */

export interface ScheduleDecision {
  shouldRun: boolean;
  reason: string;
}

/**
 * Wochentage in UTC. Die grossen Handelsplaetze (NYSE, NASDAQ, XETRA, LSE) sind
 * am Wochenende geschlossen. Ein Wochenendlauf wuerde Prognosen auf dem
 * unveraenderten Freitagskurs erzeugen: gleiche Eingaben, gleiches Ergebnis,
 * nur mehr Ledger-Rauschen ohne zusaetzliche Aussage.
 *
 * Krypto handelt durchgehend. Deshalb ist das hier bewusst eine Entscheidung
 * pro Lauf und keine harte Sperre — `allowCryptoOnWeekend` erlaubt spaeter eine
 * getrennte Behandlung, ohne die Funktion umzubauen.
 */
export function shouldGenerateForecasts(
  now: Date,
  options: { allowWeekend?: boolean } = {}
): ScheduleDecision {
  const day = now.getUTCDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend && !options.allowWeekend) {
    return {
      shouldRun: false,
      reason:
        "Wochenende: die grossen Handelsplaetze sind geschlossen. Ein Lauf wuerde Prognosen auf dem unveraenderten Schlusskurs erzeugen und den Ledger ohne Erkenntnisgewinn aufblaehen."
    };
  }

  return { shouldRun: true, reason: "Handelstag." };
}
