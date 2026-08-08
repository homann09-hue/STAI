import { periodToDate, type MacroObservation } from "@/lib/macro/sdmx";
import { describePolicyStance, type PolicyRatePath } from "@/lib/macro/policy-rate-history";
import type { MacroFrequency, MacroSeriesDefinition } from "@/lib/macro/series";

/**
 * Auswertung der Makro-Zeitreihen.
 *
 * Reine Rechnung, kein Netzzugriff. Der Zweck ist nicht, Zahlen huebscher zu
 * machen, sondern drei Fragen ehrlich zu beantworten: Wie alt ist der Wert?
 * Was hat sich veraendert? Und wann darf man daraus ueberhaupt etwas ableiten?
 *
 * Die gemessenen EZB-Reihen liefern ihre juengste Beobachtung teils Wochen
 * verzoegert. Genau deshalb ist das Datenalter hier kein Nebenfeld, sondern
 * Teil jedes Ergebnisses.
 */

export type MacroFreshness = "current" | "delayed" | "outdated";

export type MacroTrend = "rising" | "falling" | "flat" | "unknown";

export type MacroReading = {
  id: string;
  label: string;
  explanation: string;
  unit: "percent" | "ratio";
  value: number;
  period: string;
  /** Zeitpunkt der Beobachtung als ISO-Datum, nicht der Abrufzeitpunkt. */
  asOf: string;
  ageDays: number;
  freshness: MacroFreshness;
  previousValue: number | null;
  /** Veraenderung in der Einheit der Reihe. Bei Prozentreihen Prozentpunkte. */
  change: number | null;
  trend: MacroTrend;
  observationCount: number;
  source: string;
  sourceUrl: string;
  /** Warum ein Wert mit Vorsicht zu lesen ist. Leer, wenn nichts dagegen spricht. */
  caveats: string[];
};

/**
 * Ab wann ein Wert nicht mehr als aktuell gilt.
 *
 * Nach Frequenz getrennt, weil dieselbe Zahl von Tagen etwas anderes bedeutet:
 * eine Tagesreihe, die zwei Wochen alt ist, hat ein Problem. Eine Monatsreihe
 * ist dann voellig normal.
 */
const freshnessThresholds: Record<MacroFrequency, { current: number; delayed: number }> = {
  daily: { current: 7, delayed: 30 },
  business_daily: { current: 7, delayed: 30 },
  monthly: { current: 60, delayed: 120 }
};

/**
 * Wie stark sich ein Wert bewegt haben muss, damit von einem Trend die Rede
 * ist. Ohne diese Schwelle wuerde jede Rundungsdifferenz zu „steigend".
 */
const trendThreshold = { percent: 0.05, ratio: 0.002 } as const;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function classifyFreshness(ageDays: number, frequency: MacroFrequency): MacroFreshness {
  const threshold = freshnessThresholds[frequency];
  if (ageDays <= threshold.current) return "current";
  if (ageDays <= threshold.delayed) return "delayed";
  return "outdated";
}

function classifyTrend(change: number | null, unit: "percent" | "ratio"): MacroTrend {
  if (change === null) return "unknown";
  const threshold = trendThreshold[unit];
  if (Math.abs(change) < threshold) return "flat";
  return change > 0 ? "rising" : "falling";
}

/**
 * Wertet eine einzelne Reihe aus.
 *
 * Gibt `null` zurueck, wenn keine brauchbare Beobachtung vorliegt. Ein
 * Platzhalterwert waere hier besonders schaedlich: eine Makrokennzahl, die
 * niemand hinterfragt, weil sie plausibel aussieht.
 */
export function buildMacroReading(
  series: MacroSeriesDefinition,
  observations: MacroObservation[],
  now: Date = new Date()
): MacroReading | null {
  if (observations.length === 0) return null;

  const latest = observations[observations.length - 1];
  const latestDate = periodToDate(latest.period);
  if (!latestDate) return null;

  const previous = observations.length > 1 ? observations[observations.length - 2] : null;
  const change = previous ? latest.value - previous.value : null;
  const ageDays = Math.max(0, daysBetween(latestDate, now));
  const freshness = classifyFreshness(ageDays, series.frequency);

  const caveats: string[] = [];

  if (freshness === "outdated") {
    caveats.push(
      `Die jüngste Beobachtung ist ${ageDays} Tage alt. Der Wert beschreibt nicht die heutige Lage.`
    );
  } else if (freshness === "delayed") {
    caveats.push(`Die jüngste Beobachtung stammt vom ${latest.period} und ist ${ageDays} Tage alt.`);
  }

  if (previous === null) {
    caveats.push("Nur eine Beobachtung verfügbar. Eine Veränderung lässt sich daraus nicht ableiten.");
  }

  return {
    id: series.id,
    label: series.label,
    explanation: series.explanation,
    unit: series.unit,
    value: latest.value,
    period: latest.period,
    asOf: latestDate.toISOString().slice(0, 10),
    ageDays,
    freshness,
    previousValue: previous?.value ?? null,
    change,
    trend: classifyTrend(change, series.unit),
    observationCount: observations.length,
    source: series.source,
    sourceUrl: series.sourceUrl,
    caveats
  };
}

export type YieldCurveAssessment = {
  available: boolean;
  /** 10 Jahre minus 3 Monate, in Prozentpunkten. */
  spread: number | null;
  shape: "normal" | "flat" | "inverted" | "unknown";
  /** Der aeltere der beiden Stichtage — die Aussage ist nie frischer als der. */
  asOf: string | null;
  interpretation: string;
  caveats: string[];
};

/** Ab welcher Differenz die Kurve nicht mehr als flach gilt. */
const CURVE_FLAT_BAND_PERCENT_POINTS = 0.1;

/**
 * Beurteilt die Zinsstruktur aus kurzem und langem Ende.
 *
 * Die entscheidende Regel steht in §22 der Zieldefinition: unterschiedliche
 * Zeitstaende duerfen nicht unbemerkt vermischt werden. Zwei Renditen von
 * verschiedenen Tagen ergeben keine Kurve, sondern eine Differenz aus zwei
 * Momentaufnahmen. Deshalb wird die Aussage verweigert, wenn die Stichtage zu
 * weit auseinanderliegen.
 */
export function assessYieldCurve(
  shortEnd: MacroReading | null,
  longEnd: MacroReading | null,
  maxStichtagsabstandTage = 7
): YieldCurveAssessment {
  const unavailable = (reason: string): YieldCurveAssessment => ({
    available: false,
    spread: null,
    shape: "unknown",
    asOf: null,
    interpretation: reason,
    caveats: [reason]
  });

  if (!shortEnd || !longEnd) {
    return unavailable("Für eine Aussage zur Zinsstruktur fehlt mindestens eine der beiden Renditen.");
  }

  const shortDate = new Date(`${shortEnd.asOf}T00:00:00.000Z`);
  const longDate = new Date(`${longEnd.asOf}T00:00:00.000Z`);
  const gapDays = Math.abs(daysBetween(shortDate, longDate));

  if (gapDays > maxStichtagsabstandTage) {
    return unavailable(
      `Die beiden Renditen stammen von unterschiedlichen Stichtagen (${shortEnd.asOf} und ${longEnd.asOf}). Eine Zinsstruktur daraus wäre eine Scheingenauigkeit.`
    );
  }

  const spread = longEnd.value - shortEnd.value;
  const shape =
    Math.abs(spread) < CURVE_FLAT_BAND_PERCENT_POINTS ? "flat" : spread > 0 ? "normal" : "inverted";

  const interpretation =
    shape === "inverted"
      ? "Kurzfristige Anleihen rentieren höher als langfristige. Historisch ging eine solche Umkehrung wirtschaftlichen Abschwächungen oft voraus — sie ist ein Signal, keine Vorhersage."
      : shape === "flat"
        ? "Kurzes und langes Ende liegen praktisch gleichauf. Der Markt erwartet weder deutlich steigende noch fallende Zinsen."
        : "Langfristige Anleihen rentieren höher als kurzfristige. Das ist die übliche Form der Zinskurve.";

  // Der aeltere Stichtag bestimmt, wie alt die Aussage ist.
  const asOf = shortEnd.asOf <= longEnd.asOf ? shortEnd.asOf : longEnd.asOf;
  const caveats: string[] = [];

  if (shortEnd.freshness !== "current" || longEnd.freshness !== "current") {
    caveats.push(
      `Die zugrunde liegenden Renditen sind nicht tagesaktuell (Stand ${asOf}). Die Einordnung beschreibt diesen Stichtag.`
    );
  }

  return { available: true, spread, shape, asOf, interpretation, caveats };
}

export type MacroOverview = {
  readings: MacroReading[];
  yieldCurve: YieldCurveAssessment;
  /** Zinsentscheidungen, abgeleitet aus dem Leitzinspfad. Null, wenn er fehlt. */
  policyRate: (PolicyRatePath & { summary: string }) | null;
  /** Reihen, die angefragt, aber nicht geliefert wurden. */
  unavailableSeries: string[];
  /** Ob überhaupt eine belastbare Aussage möglich ist. */
  reportable: boolean;
  disclaimer: string;
};

export function buildMacroOverview(
  readings: MacroReading[],
  unavailableSeries: string[],
  policyRatePath: PolicyRatePath | null = null
): MacroOverview {
  const byId = new Map(readings.map((reading) => [reading.id, reading]));

  return {
    readings,
    yieldCurve: assessYieldCurve(byId.get("ea_yield_3m") ?? null, byId.get("ea_yield_10y") ?? null),
    policyRate: policyRatePath ? { ...policyRatePath, summary: describePolicyStance(policyRatePath) } : null,
    unavailableSeries,
    // Eine einzelne Reihe ist keine Makrolage. Ohne mindestens zwei Werte wird
    // nichts als Gesamtbild ausgegeben.
    reportable: readings.length >= 2,
    disclaimer:
      "Makrodaten stammen vom EZB Data Portal und beschreiben den jeweils genannten Stichtag, nicht den heutigen Tag. Keine Anlageberatung."
  };
}
