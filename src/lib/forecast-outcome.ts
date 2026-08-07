/**
 * Auswertung veröffentlichter Prognosen gegen das tatsächlich eingetretene
 * Ergebnis.
 *
 * Reine Funktionen ohne I/O. Die gesamte Rechnung ist deterministisch und
 * testbar; kein Sprachmodell ist beteiligt.
 *
 * Warum das der zentrale Baustein ist: Der Forecast Ledger schreibt Prognosen
 * unveränderlich fort. Ohne Auswertung bleibt er ein Archiv. Erst der Vergleich
 * mit dem Ergebnis — und mit einer naiven Baseline — macht daraus eine
 * überprüfbare Trefferbilanz.
 *
 * Schlechte Prognosen werden nicht gelöscht und nicht versteckt.
 */

export type ForecastOutcomeStatus = "pending" | "matured" | "blocked" | "insufficient_data";

export type ForecastDirection = "up" | "down" | "sideways";

/**
 * Die Prognosebänder werden als Median ± (annualisierte Volatilität × √Horizont)
 * gebildet, also als ungefähres 1-Sigma-Intervall. Unter Normalverteilungs-
 * annahme entspricht das einer nominellen Abdeckung von 68,27 %.
 *
 * Dieser Wert ist der Sollwert für die Kalibrierung: deckt das Band deutlich
 * mehr ab, ist es zu breit; deutlich weniger, ist es zu eng. Beides ist ein
 * Modellfehler, auch wenn "zu breit" harmloser wirkt.
 */
export const NOMINAL_BAND_COVERAGE_PERCENT = 68.27;

export interface ForecastBandSnapshot {
  medianReturnPercent: number | null;
  lowerReturnPercent: number | null;
  upperReturnPercent: number | null;
  expectedVolatilityPercent: number | null;
}

export interface ForecastOutcomeInput {
  basePrice: number | null;
  realizedPrice: number | null;
  band: ForecastBandSnapshot;
  probabilityUp: number;
  probabilityDown: number;
  probabilitySideways: number;
  /**
   * Naive Vergleichsprognose: Kurs bleibt unverändert (Random Walk ohne Drift).
   * Ein Modell, das diese Baseline nicht schlägt, hat keinen nachgewiesenen
   * Mehrwert.
   */
  baselineReturnPercent?: number;
  forecastStatus?: "ready" | "limited" | "blocked";
}

export interface ForecastOutcomeResult {
  outcomeStatus: ForecastOutcomeStatus;
  realizedReturnPercent: number | null;
  insideForecastBand: boolean | null;
  predictedDirection: ForecastDirection | null;
  realizedDirection: ForecastDirection | null;
  directionHit: boolean | null;
  modelErrorPercent: number | null;
  baselineErrorPercent: number | null;
  /** Positiv heisst: das Modell war naeher am Ergebnis als die Baseline. */
  modelBeatsBaselineBy: number | null;
  notes: string[];
}

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Schwelle, unterhalb derer eine Bewegung als seitwärts gilt.
 *
 * Abgeleitet aus der erwarteten Volatilität des Horizonts statt fest gesetzt:
 * eine Bewegung von 1 % ist bei einer ruhigen Anleihe eine Richtung, bei einem
 * volatilen Kryptowert Rauschen. Ohne Volatilitätsangabe ist keine belastbare
 * Richtungsaussage moeglich — dann wird `null` zurueckgegeben statt geraten.
 */
export function sidewaysThresholdPercent(expectedVolatilityPercent: number | null): number | null {
  if (!isUsableNumber(expectedVolatilityPercent) || expectedVolatilityPercent <= 0) return null;
  return round(expectedVolatilityPercent / 3);
}

export function classifyDirection(
  returnPercent: number,
  thresholdPercent: number | null
): ForecastDirection | null {
  if (thresholdPercent === null) return null;
  if (Math.abs(returnPercent) <= thresholdPercent) return "sideways";
  return returnPercent > 0 ? "up" : "down";
}

/**
 * Vorhergesagte Richtung aus der Wahrscheinlichkeitsverteilung.
 *
 * Bei Gleichstand gibt es keine Aussage. Ein Modell, das up und down gleich
 * gewichtet, hat sich nicht festgelegt — das als Treffer oder Fehltreffer zu
 * werten waere in beiden Richtungen falsch.
 */
export function predictedDirectionFromProbabilities(input: {
  probabilityUp: number;
  probabilityDown: number;
  probabilitySideways: number;
}): ForecastDirection | null {
  const entries: Array<[ForecastDirection, number]> = [
    ["up", input.probabilityUp],
    ["down", input.probabilityDown],
    ["sideways", input.probabilitySideways]
  ].filter((entry): entry is [ForecastDirection, number] => isUsableNumber(entry[1]));

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, value]) => value));
  const winners = entries.filter(([, value]) => value === max);

  return winners.length === 1 ? winners[0][0] : null;
}

/**
 * Wertet eine einzelne Prognose aus.
 *
 * Gibt niemals ein Scheinergebnis zurueck: fehlen Ausgangspreis, realisierter
 * Preis oder Band, ist das Ergebnis `insufficient_data` mit begruendendem
 * Hinweis — nicht ein auf null gesetzter Fehler.
 */
export function evaluateForecastOutcome(input: ForecastOutcomeInput): ForecastOutcomeResult {
  const notes: string[] = [];

  const empty: ForecastOutcomeResult = {
    outcomeStatus: "insufficient_data",
    realizedReturnPercent: null,
    insideForecastBand: null,
    predictedDirection: null,
    realizedDirection: null,
    directionHit: null,
    modelErrorPercent: null,
    baselineErrorPercent: null,
    modelBeatsBaselineBy: null,
    notes
  };

  if (input.forecastStatus === "blocked") {
    notes.push("Prognose war blockiert und wird nicht bewertet.");
    return { ...empty, outcomeStatus: "blocked", notes };
  }

  if (!isUsableNumber(input.basePrice) || input.basePrice <= 0) {
    notes.push("Ausgangspreis fehlt oder ist unbrauchbar.");
    return empty;
  }

  if (!isUsableNumber(input.realizedPrice) || input.realizedPrice <= 0) {
    notes.push("Realisierter Preis zum Auswertungszeitpunkt liegt nicht vor.");
    return empty;
  }

  const realizedReturnPercent = round(((input.realizedPrice - input.basePrice) / input.basePrice) * 100);

  const { medianReturnPercent, lowerReturnPercent, upperReturnPercent } = input.band;

  const insideForecastBand =
    isUsableNumber(lowerReturnPercent) && isUsableNumber(upperReturnPercent)
      ? realizedReturnPercent >= lowerReturnPercent && realizedReturnPercent <= upperReturnPercent
      : null;

  if (insideForecastBand === null) {
    notes.push("Prognoseband unvollständig: Bandabdeckung nicht bewertbar.");
  }

  const threshold = sidewaysThresholdPercent(input.band.expectedVolatilityPercent);
  const predictedDirection = predictedDirectionFromProbabilities(input);
  const realizedDirection = classifyDirection(realizedReturnPercent, threshold);

  if (threshold === null) {
    notes.push("Ohne erwartete Volatilität ist keine belastbare Richtungsaussage möglich.");
  }

  if (predictedDirection === null) {
    notes.push("Modell hat sich auf keine Richtung festgelegt.");
  }

  const directionHit =
    predictedDirection !== null && realizedDirection !== null ? predictedDirection === realizedDirection : null;

  const modelErrorPercent = isUsableNumber(medianReturnPercent)
    ? round(Math.abs(realizedReturnPercent - medianReturnPercent))
    : null;

  if (modelErrorPercent === null) {
    notes.push("Kein Medianwert im Band: Prognosefehler nicht berechenbar.");
  }

  // Baseline: unveraenderter Kurs, sofern nicht anders vorgegeben.
  const baselineReturnPercent = isUsableNumber(input.baselineReturnPercent) ? input.baselineReturnPercent : 0;
  const baselineErrorPercent = round(Math.abs(realizedReturnPercent - baselineReturnPercent));

  const modelBeatsBaselineBy =
    modelErrorPercent === null ? null : round(baselineErrorPercent - modelErrorPercent);

  return {
    outcomeStatus: "matured",
    realizedReturnPercent,
    insideForecastBand,
    predictedDirection,
    realizedDirection,
    directionHit,
    modelErrorPercent,
    baselineErrorPercent,
    modelBeatsBaselineBy,
    notes
  };
}

export interface ModelEvaluationSummary {
  forecastCount: number;
  maturedCount: number;
  /** Anteil der Ergebnisse innerhalb des Prognosebands, in Prozent. */
  intervalCoveragePercent: number | null;
  /** Abweichung von der nominellen Abdeckung. Kleiner ist besser. */
  calibrationErrorPercent: number | null;
  directionAccuracyPercent: number | null;
  averageModelErrorPercent: number | null;
  averageBaselineErrorPercent: number | null;
  /** Positiv heisst: das Modell war im Mittel naeher am Ergebnis als die Baseline. */
  modelBeatsBaselineByPercent: number | null;
  beatsBaseline: boolean | null;
  calibrationBucket: "zu_eng" | "kalibriert" | "zu_breit" | "unbekannt";
  notes: string[];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Aggregiert ausgewertete Prognosen zu einer Modellbilanz.
 *
 * Wichtige Eigenschaft: die Bilanz wird nur ueber tatsaechlich gereifte
 * Prognosen gebildet. Blockierte und unbewertbare Faelle zaehlen in
 * `forecastCount`, aber nicht in die Quoten — sonst liesse sich die Trefferquote
 * schoenen, indem man schwierige Faelle als unbewertbar markiert.
 *
 * Die Anzahl bleibt deshalb sichtbar: ein Modell mit 90 % Trefferquote aus drei
 * von hundert bewerteten Prognosen ist kein gutes Modell.
 */
export function aggregateModelEvaluation(
  results: ForecastOutcomeResult[],
  options: { minimumSampleSize?: number } = {}
): ModelEvaluationSummary {
  const minimumSampleSize = options.minimumSampleSize ?? 20;
  const notes: string[] = [];

  const matured = results.filter((result) => result.outcomeStatus === "matured");

  const bandJudged = matured.filter((result) => result.insideForecastBand !== null);
  const directionJudged = matured.filter((result) => result.directionHit !== null);
  const modelErrors = matured
    .map((result) => result.modelErrorPercent)
    .filter((value): value is number => isUsableNumber(value));
  const baselineErrors = matured
    .map((result) => result.baselineErrorPercent)
    .filter((value): value is number => isUsableNumber(value));

  const intervalCoveragePercent =
    bandJudged.length > 0
      ? round((bandJudged.filter((result) => result.insideForecastBand === true).length / bandJudged.length) * 100, 2)
      : null;

  const directionAccuracyPercent =
    directionJudged.length > 0
      ? round((directionJudged.filter((result) => result.directionHit === true).length / directionJudged.length) * 100, 2)
      : null;

  const averageModelErrorPercent = average(modelErrors);
  const averageBaselineErrorPercent = average(baselineErrors);

  const modelBeatsBaselineByPercent =
    averageModelErrorPercent === null || averageBaselineErrorPercent === null
      ? null
      : round(averageBaselineErrorPercent - averageModelErrorPercent);

  const calibrationErrorPercent =
    intervalCoveragePercent === null
      ? null
      : round(Math.abs(intervalCoveragePercent - NOMINAL_BAND_COVERAGE_PERCENT), 2);

  let calibrationBucket: ModelEvaluationSummary["calibrationBucket"] = "unbekannt";
  if (intervalCoveragePercent !== null) {
    // 10 Prozentpunkte Toleranz um die nominelle Abdeckung.
    if (intervalCoveragePercent < NOMINAL_BAND_COVERAGE_PERCENT - 10) calibrationBucket = "zu_eng";
    else if (intervalCoveragePercent > NOMINAL_BAND_COVERAGE_PERCENT + 10) calibrationBucket = "zu_breit";
    else calibrationBucket = "kalibriert";
  }

  if (matured.length < minimumSampleSize) {
    notes.push(
      `Stichprobe zu klein für eine belastbare Aussage: ${matured.length} von mindestens ${minimumSampleSize} bewerteten Prognosen.`
    );
  }

  if (results.length > 0 && matured.length / results.length < 0.5) {
    notes.push(
      `Nur ${matured.length} von ${results.length} Prognosen waren bewertbar. Eine niedrige Bewertungsquote entwertet die Trefferquote.`
    );
  }

  return {
    forecastCount: results.length,
    maturedCount: matured.length,
    intervalCoveragePercent,
    calibrationErrorPercent,
    directionAccuracyPercent,
    averageModelErrorPercent,
    averageBaselineErrorPercent,
    modelBeatsBaselineByPercent,
    // Bewusst erst ab ausreichender Stichprobe eine Aussage.
    beatsBaseline:
      modelBeatsBaselineByPercent === null || matured.length < minimumSampleSize
        ? null
        : modelBeatsBaselineByPercent > 0,
    calibrationBucket,
    notes
  };
}
