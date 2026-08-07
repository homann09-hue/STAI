import { NOMINAL_BAND_COVERAGE_PERCENT } from "@/lib/forecast-outcome";

/**
 * Aufbereitung der Modellbilanz für die Anzeige.
 *
 * Reine Funktionen ohne I/O. Der wichtigste Zweck ist nicht die Formatierung,
 * sondern die Entscheidung, **wann keine Aussage getroffen werden darf**.
 * Eine Trefferbilanz, die bei drei Datenpunkten schon eine Quote anzeigt, ist
 * irreführender als gar keine Anzeige.
 */

export type TrackRecordReadiness = "no_data" | "insufficient_sample" | "reportable";

export interface ModelEvaluationRow {
  modelKey: string;
  modelVersion: string;
  windowStart: string;
  windowEnd: string;
  forecastCount: number;
  maturedCount: number;
  intervalCoveragePercent: number | null;
  directionAccuracyPercent: number | null;
  averageModelErrorPercent: number | null;
  averageBaselineErrorPercent: number | null;
  calibrationBucket: string;
}

export interface TrackRecordMetric {
  label: string;
  value: string;
  /** Erläuterung in Alltagssprache, kein Fachjargon. */
  meaning: string;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface TrackRecordView {
  readiness: TrackRecordReadiness;
  headline: string;
  explanation: string;
  metrics: TrackRecordMetric[];
  /** Was die Zahlen ausdrücklich nicht aussagen. */
  caveats: string[];
  evaluationRatePercent: number | null;
  minimumSampleSize: number;
}

const MINIMUM_SAMPLE_SIZE = 20;

function formatPercent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")} %`;
}

function calibrationCopy(bucket: string): { text: string; tone: TrackRecordMetric["tone"] } {
  if (bucket === "kalibriert") {
    return { text: "kalibriert", tone: "good" };
  }
  if (bucket === "zu_eng") {
    return { text: "zu eng", tone: "bad" };
  }
  if (bucket === "zu_breit") {
    // Bewusst als Mangel, nicht als Erfolg. Ein Band, das fast immer trifft,
    // sagt nichts aus.
    return { text: "zu breit", tone: "warn" };
  }
  return { text: "unbekannt", tone: "neutral" };
}

/**
 * Baut die Anzeige aus der jüngsten Modellbilanz.
 *
 * Drei Zustände, bewusst getrennt:
 * - `no_data`: es wurde noch nichts ausgewertet. Keine Zahlen.
 * - `insufficient_sample`: es gibt Zahlen, aber zu wenige für eine Aussage.
 *   Sie werden gezeigt und ausdrücklich als nicht belastbar gekennzeichnet.
 * - `reportable`: genug bewertete Prognosen für eine Aussage.
 */
export function buildTrackRecordView(
  evaluation: ModelEvaluationRow | null,
  options: { minimumSampleSize?: number } = {}
): TrackRecordView {
  const minimumSampleSize = options.minimumSampleSize ?? MINIMUM_SAMPLE_SIZE;

  if (!evaluation || evaluation.maturedCount === 0) {
    return {
      readiness: "no_data",
      headline: "Noch keine ausgewertete Prognose",
      explanation:
        "Prognosen werden erst nach Ablauf ihres Horizonts gegen den tatsächlichen Kurs geprüft. Bis dahin gibt es keine Trefferbilanz — und wir zeigen keine.",
      metrics: [],
      caveats: [
        "Eine Bilanz entsteht frühestens, wenn die ersten Prognosen ihren Horizont erreicht haben.",
        "Es werden keine Beispiel- oder Demowerte angezeigt."
      ],
      evaluationRatePercent: null,
      minimumSampleSize
    };
  }

  const evaluationRatePercent =
    evaluation.forecastCount > 0
      ? Math.round((evaluation.maturedCount / evaluation.forecastCount) * 1000) / 10
      : null;

  const calibration = calibrationCopy(evaluation.calibrationBucket);

  const beatsBaseline =
    evaluation.averageModelErrorPercent === null || evaluation.averageBaselineErrorPercent === null
      ? null
      : evaluation.averageBaselineErrorPercent - evaluation.averageModelErrorPercent;

  const metrics: TrackRecordMetric[] = [
    {
      label: "Bewertete Prognosen",
      value: `${evaluation.maturedCount} von ${evaluation.forecastCount}`,
      meaning:
        "Nur Prognosen, deren Horizont abgelaufen ist und für die ein echter Kurs vorlag. Eine niedrige Quote entwertet alle anderen Zahlen.",
      tone: evaluationRatePercent !== null && evaluationRatePercent < 50 ? "warn" : "neutral"
    },
    {
      label: "Bandabdeckung",
      value: formatPercent(evaluation.intervalCoveragePercent),
      meaning: `So oft lag der tatsächliche Kurs im prognostizierten Band. Der Sollwert liegt bei rund ${NOMINAL_BAND_COVERAGE_PERCENT.toFixed(0)} %: deutlich mehr heißt, das Band war zu breit und damit wenig aussagekräftig.`,
      tone: calibration.tone
    },
    {
      label: "Kalibrierung",
      value: calibration.text,
      meaning:
        "Ein zu enges Band unterschätzt das Risiko. Ein zu breites Band trifft fast immer und sagt deshalb nichts aus. Beides ist ein Modellfehler.",
      tone: calibration.tone
    },
    {
      label: "Richtungstreffer",
      value: formatPercent(evaluation.directionAccuracyPercent),
      meaning:
        "Anteil der Fälle, in denen die vorhergesagte Richtung eintrat. Bei drei möglichen Richtungen ist der Zufallswert rund 33 %.",
      tone:
        evaluation.directionAccuracyPercent === null
          ? "neutral"
          : evaluation.directionAccuracyPercent > 40
            ? "good"
            : "warn"
    },
    {
      label: "Gegen naive Baseline",
      value:
        beatsBaseline === null
          ? "—"
          : `${beatsBaseline > 0 ? "+" : ""}${beatsBaseline.toFixed(2).replace(".", ",")} Prozentpunkte`,
      meaning:
        "Vergleich mit der simpelsten Annahme: der Kurs bleibt unverändert. Ein positiver Wert heißt, das Modell lag näher am Ergebnis. Ein Modell, das diese Baseline nicht schlägt, hat keinen belegten Mehrwert.",
      tone: beatsBaseline === null ? "neutral" : beatsBaseline > 0 ? "good" : "bad"
    }
  ];

  const caveats = [
    "Vergangene Treffer sagen nichts über künftige Ergebnisse.",
    "Schlechte Prognosen werden nicht gelöscht und fließen vollständig in diese Zahlen ein.",
    "Keine Anlageberatung."
  ];

  if (evaluationRatePercent !== null && evaluationRatePercent < 50) {
    caveats.unshift(
      `Nur ${evaluationRatePercent.toFixed(0).replace(".", ",")} % der Prognosen waren überhaupt bewertbar. Die übrigen Zahlen beziehen sich auf diese Teilmenge.`
    );
  }

  if (evaluation.maturedCount < minimumSampleSize) {
    return {
      readiness: "insufficient_sample",
      headline: "Zu wenige Prognosen für eine belastbare Aussage",
      explanation: `Es liegen ${evaluation.maturedCount} bewertete Prognosen vor. Für eine tragfähige Aussage sind mindestens ${minimumSampleSize} nötig. Die Zahlen werden trotzdem gezeigt — aber sie sind noch kein Beleg.`,
      metrics,
      caveats: [
        `Stichprobe unter ${minimumSampleSize}: einzelne Ausreißer verzerren jede Quote stark.`,
        ...caveats
      ],
      evaluationRatePercent,
      minimumSampleSize
    };
  }

  return {
    readiness: "reportable",
    headline: `Trefferbilanz aus ${evaluation.maturedCount} bewerteten Prognosen`,
    explanation:
      "Jede veröffentlichte Prognose wird nach Ablauf ihres Horizonts gegen den tatsächlichen Kurs geprüft. Der Eintrag ist unveränderlich; nachträgliches Korrigieren ist technisch ausgeschlossen.",
    metrics,
    caveats,
    evaluationRatePercent,
    minimumSampleSize
  };
}
