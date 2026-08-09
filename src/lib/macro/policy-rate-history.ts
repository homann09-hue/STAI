import { periodToDate, type MacroObservation } from "@/lib/macro/sdmx";

/**
 * Zinsentscheidungen der EZB, abgeleitet aus dem Leitzinspfad.
 *
 * Die EZB veröffentlicht den Hauptrefinanzierungssatz als tägliche Reihe. Jede
 * Änderung des Werts ist eine Zinsentscheidung, die an diesem Tag wirksam wurde.
 * Damit lässt sich die Entscheidungshistorie ohne eine zweite Datenquelle
 * herleiten.
 *
 * Was hier bewusst **nicht** behauptet wird:
 *
 *  - Das ist kein Sitzungskalender. Der Tag, an dem ein Zinssatz wirksam wird,
 *    ist nicht der Tag der Ratssitzung — dazwischen liegen in der Regel einige
 *    Tage.
 *  - Es sind keine künftigen Termine. Aus einem Kurspfad lässt sich kein
 *    kommender Sitzungstermin ableiten, und geraten wird hier nichts.
 *  - Die Aussage gilt nur für das abgerufene Zeitfenster. „Keine Änderung"
 *    heißt „keine Änderung in diesem Fenster", nicht „nie geändert".
 */

export type PolicyRateDirection = "hike" | "cut";

export type PolicyRateChange = {
  /** Tag, an dem der neue Satz erstmals in der Reihe steht. */
  effectiveFrom: string;
  previousRate: number;
  newRate: number;
  /** Veränderung in Prozentpunkten, positiv bei einer Anhebung. */
  deltaPercentagePoints: number;
  direction: PolicyRateDirection;
};

export type PolicyRatePath = {
  /** Erster und letzter Tag der ausgewerteten Reihe. */
  windowStart: string | null;
  windowEnd: string | null;
  changes: PolicyRateChange[];
  lastChange: PolicyRateChange | null;
  daysSinceLastChange: number | null;
  currentRate: number | null;
  /** Was der Nutzer über die Grenzen dieser Auswertung wissen muss. */
  notes: string[];
};

const MAX_REPORTED_CHANGES = 12;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Leitet die Zinsschritte aus dem beobachteten Pfad ab.
 *
 * Die erste Beobachtung ist nie eine Änderung — sie ist der Startwert des
 * Fensters. Wer sie als Schritt zählte, würde bei jedem Abruf eine
 * Zinsentscheidung erfinden, die nur daher rührt, wo das Fenster beginnt.
 */
export function derivePolicyRatePath(observations: MacroObservation[], now: Date = new Date()): PolicyRatePath {
  const usable = observations.filter((observation) => periodToDate(observation.period) !== null);

  if (usable.length === 0) {
    return {
      windowStart: null,
      windowEnd: null,
      changes: [],
      lastChange: null,
      daysSinceLastChange: null,
      currentRate: null,
      notes: ["Für den Leitzins liegen keine auswertbaren Beobachtungen vor."]
    };
  }

  const changes: PolicyRateChange[] = [];

  for (let index = 1; index < usable.length; index += 1) {
    const previous = usable[index - 1];
    const current = usable[index];
    if (current.value === previous.value) continue;

    changes.push({
      effectiveFrom: current.period,
      previousRate: previous.value,
      newRate: current.value,
      deltaPercentagePoints: Number((current.value - previous.value).toFixed(4)),
      direction: current.value > previous.value ? "hike" : "cut"
    });
  }

  const windowStart = usable[0].period;
  const windowEnd = usable[usable.length - 1].period;
  const currentRate = usable[usable.length - 1].value;
  const lastChange = changes.length > 0 ? changes[changes.length - 1] : null;

  const lastChangeDate = lastChange ? periodToDate(lastChange.effectiveFrom) : null;
  const daysSinceLastChange = lastChangeDate ? Math.max(0, daysBetween(lastChangeDate, now)) : null;

  const notes = [
    `Abgeleitet aus dem Leitzinspfad vom ${windowStart} bis ${windowEnd}. Aussagen gelten nur für dieses Zeitfenster.`,
    "Das Datum ist der Tag, an dem der Satz wirksam wurde, nicht der Tag der Ratssitzung.",
    "Künftige Sitzungstermine sind hier nicht enthalten und werden nicht geschätzt."
  ];

  if (changes.length === 0) {
    notes.unshift("Im beobachteten Zeitraum gab es keine Zinsänderung. Das bedeutet nicht, dass es davor keine gab.");
  }

  return {
    windowStart,
    windowEnd,
    // Die jüngsten Schritte zuerst, aber begrenzt: eine Liste mit dreißig
    // Einträgen beantwortet keine Frage, die jemand tatsächlich hat.
    changes: changes.slice(-MAX_REPORTED_CHANGES).reverse(),
    lastChange,
    daysSinceLastChange,
    currentRate,
    notes
  };
}

/**
 * Beschreibt die geldpolitische Richtung des beobachteten Fensters.
 *
 * Bewusst zurückhaltend: aus zwei Senkungen wird kein „Zinssenkungszyklus"
 * ausgerufen. Die Funktion beschreibt, was im Fenster passiert ist, und nicht,
 * was daraus folgen soll.
 */
export function describePolicyStance(path: PolicyRatePath): string {
  if (path.currentRate === null) return "Zum Leitzins liegen keine Daten vor.";

  const rate = path.currentRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!path.lastChange) {
    return `Der Leitzins liegt bei ${rate} % und wurde im beobachteten Zeitraum nicht verändert.`;
  }

  const step = Math.abs(path.lastChange.deltaPercentagePoints).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const verb = path.lastChange.direction === "hike" ? "angehoben" : "gesenkt";
  const since =
    path.daysSinceLastChange === null
      ? ""
      : path.daysSinceLastChange === 0
        ? " (heute wirksam)"
        : ` (seit ${path.daysSinceLastChange} Tagen unverändert)`;

  const hikes = path.changes.filter((change) => change.direction === "hike").length;
  const cuts = path.changes.filter((change) => change.direction === "cut").length;
  const plural = (count: number, singular: string, pluralForm: string) =>
    `${count} ${count === 1 ? singular : pluralForm}`;

  const balance =
    hikes > 0 && cuts > 0
      ? ` Im Fenster liegen ${plural(hikes, "Anhebung", "Anhebungen")} und ${plural(cuts, "Senkung", "Senkungen")}.`
      : path.changes.length > 1
        ? ` Alle ${path.changes.length} Schritte im Fenster gingen in dieselbe Richtung.`
        : "";

  return `Der Leitzins liegt bei ${rate} % und wurde zuletzt am ${path.lastChange.effectiveFrom} um ${step} Prozentpunkte ${verb}${since}.${balance}`;
}
