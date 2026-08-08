/**
 * Technische Indikatoren.
 *
 * Vor dieser Datei gab es keine. `chart-data.ts` setzte den RSI hart auf 50,
 * der Mock würfelte ihn — die Typen versprachen RSI, MACD und Bollinger Bänder,
 * berechnet wurde nichts davon. Ein Nutzer, der eine dieser Zahlen las, las
 * eine Erfindung.
 *
 * Reine Rechnung auf Zeitreihen, kein Netzzugriff, keine Zustände.
 *
 * **Die durchgehende Regel:** jede Funktion gibt `null` zurück, wenn die
 * Zeitreihe zu kurz ist. Ein RSI aus drei Kerzen ist kein RSI, und ein
 * eingesetzter Standardwert wäre schlimmer als eine Lücke — niemand
 * hinterfragt eine Zahl, die plausibel aussieht.
 */

export type Candle = {
  close: number;
  high: number;
  low: number;
  volume: number;
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function closes(candles: readonly Candle[]) {
  return candles.map((candle) => candle.close).filter(isNumber);
}

/** Einfacher gleitender Durchschnitt über die letzten `period` Werte. */
export function sma(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((sum, value) => sum + value, 0) / period;
}

/**
 * Exponentiell gewichteter Durchschnitt.
 *
 * Startet auf dem SMA der ersten Periode — das ist die übliche Konvention und
 * vermeidet, dass der erste Wert das Ergebnis dauerhaft verzerrt.
 */
export function ema(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (const value of values.slice(period)) {
    current = (value - current) * multiplier + current;
  }
  return current;
}

/**
 * Relative Stärke nach Wilder.
 *
 * Braucht `period + 1` Werte, weil der erste Wert nur als Vergleichspunkt für
 * die erste Veränderung dient.
 */
export function rsi(values: readonly number[], period = 14): number | null {
  if (values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  // Wilders Glaettung fuer die restlichen Werte.
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(0, change)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(0, -change)) / period;
  }

  // Ohne Verluste ist die relative Staerke unendlich; per Definition 100.
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;

  return 100 - 100 / (1 + averageGain / averageLoss);
}

export type MacdResult = { macd: number; signal: number; histogram: number };

/** MACD mit Signallinie. Ohne genug Werte für die Signallinie: null. */
export function macd(values: readonly number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult | null {
  if (values.length < slow + signalPeriod) return null;

  const line: number[] = [];
  for (let end = slow; end <= values.length; end += 1) {
    const slice = values.slice(0, end);
    const fastEma = ema(slice, fast);
    const slowEma = ema(slice, slow);
    if (fastEma === null || slowEma === null) continue;
    line.push(fastEma - slowEma);
  }

  if (line.length < signalPeriod) return null;

  const macdValue = line[line.length - 1];
  const signal = ema(line, signalPeriod);
  if (signal === null) return null;

  return { macd: macdValue, signal, histogram: macdValue - signal };
}

export type BollingerBands = { upper: number; middle: number; lower: number; bandwidth: number };

export function bollingerBands(values: readonly number[], period = 20, deviations = 2): BollingerBands | null {
  const middle = sma(values, period);
  if (middle === null) return null;

  const window = values.slice(-period);
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);

  return {
    upper: middle + deviations * sd,
    middle,
    lower: middle - deviations * sd,
    // Relative Bandbreite: vergleichbar zwischen Instrumenten mit ganz
    // unterschiedlichen Kursniveaus.
    bandwidth: middle === 0 ? 0 : (2 * deviations * sd) / middle
  };
}

/** Average True Range nach Wilder. Braucht Hoch, Tief und Vorschlusskurs. */
export function atr(candles: readonly Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previousClose = candles[index - 1].close;
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previousClose),
        Math.abs(current.low - previousClose)
      )
    );
  }

  if (trueRanges.length < period) return null;

  let value = trueRanges.slice(0, period).reduce((sum, entry) => sum + entry, 0) / period;
  for (const entry of trueRanges.slice(period)) {
    value = (value * (period - 1) + entry) / period;
  }
  return value;
}

export type Stochastic = { k: number; d: number };

export function stochastic(candles: readonly Candle[], period = 14, smoothing = 3): Stochastic | null {
  if (candles.length < period + smoothing - 1) return null;

  const kValues: number[] = [];
  for (let end = period; end <= candles.length; end += 1) {
    const window = candles.slice(end - period, end);
    const highest = Math.max(...window.map((candle) => candle.high));
    const lowest = Math.min(...window.map((candle) => candle.low));
    const close = window[window.length - 1].close;

    // Ohne Spanne ist %K unbestimmt. 50 ist hier keine Schaetzung, sondern die
    // Definition: der Kurs liegt genau in der Mitte einer Spanne von null.
    kValues.push(highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100);
  }

  const k = kValues[kValues.length - 1];
  const d = sma(kValues, smoothing);
  return d === null ? null : { k, d };
}

/** Rate of Change in Prozent über `period` Perioden. */
export function roc(values: readonly number[], period = 12): number | null {
  if (values.length < period + 1) return null;
  const past = values[values.length - 1 - period];
  if (past === 0) return null;
  return ((values[values.length - 1] - past) / past) * 100;
}

/**
 * On-Balance-Volume.
 *
 * Absolut wenig aussagekräftig — entscheidend ist die Richtung. Deshalb wird
 * zusätzlich der Trend über die letzten Perioden zurückgegeben.
 */
export function obv(candles: readonly Candle[]): { value: number; risingShare: number } | null {
  if (candles.length < 2) return null;

  let value = 0;
  const series: number[] = [0];

  for (let index = 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    if (change > 0) value += candles[index].volume;
    else if (change < 0) value -= candles[index].volume;
    series.push(value);
  }

  const rising = series.slice(1).filter((entry, index) => entry > series[index]).length;
  return { value, risingShare: rising / (series.length - 1) };
}

/**
 * Volumengewichteter Durchschnittskurs.
 *
 * Ohne Volumen nicht berechenbar — und ein ungewichteter Durchschnitt wäre
 * kein VWAP, sondern ein anderer Indikator unter falschem Namen.
 */
export function vwap(candles: readonly Candle[]): number | null {
  if (candles.length === 0) return null;

  const totalVolume = candles.reduce((sum, candle) => sum + Math.max(0, candle.volume), 0);
  if (totalVolume <= 0) return null;

  const weighted = candles.reduce((sum, candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    return sum + typical * Math.max(0, candle.volume);
  }, 0);

  return weighted / totalVolume;
}

/** Annualisierte Volatilität aus logarithmischen Tagesrenditen. */
export function volatility(values: readonly number[], tradingDays = 252): number | null {
  if (values.length < 3) return null;

  const returns: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    if (previous <= 0 || values[index] <= 0) continue;
    returns.push(Math.log(values[index] / previous));
  }

  if (returns.length < 2) return null;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(tradingDays);
}

export type SupportResistance = { support: number; resistance: number; position: number };

/**
 * Unterstützung und Widerstand als Extremwerte des Fensters.
 *
 * Bewusst simpel und als solches benannt: das sind Hoch und Tief der Periode,
 * keine über Berührungspunkte validierten Zonen. `position` sagt, wo der
 * aktuelle Kurs zwischen beiden steht — 0 an der Unterstützung, 1 am
 * Widerstand.
 */
export function supportResistance(candles: readonly Candle[], period = 20): SupportResistance | null {
  if (candles.length < period) return null;

  const window = candles.slice(-period);
  const support = Math.min(...window.map((candle) => candle.low));
  const resistance = Math.max(...window.map((candle) => candle.high));
  const close = window[window.length - 1].close;

  return {
    support,
    resistance,
    position: resistance === support ? 0.5 : (close - support) / (resistance - support)
  };
}

export type MovingAverageCross = "golden_cross" | "death_cross" | "none";

/**
 * Kreuzung zweier gleitender Durchschnitte — nur die **frische**.
 *
 * Ein Kreuz, das vor Monaten stattfand, ist kein Ereignis mehr. Gemeldet wird
 * nur, wenn sich das Verhältnis zwischen der vorletzten und der letzten Periode
 * gedreht hat.
 */
export function movingAverageCross(
  values: readonly number[],
  fast = 50,
  slow = 200
): MovingAverageCross | null {
  if (values.length < slow + 1) return null;

  const previous = values.slice(0, -1);
  const fastNow = sma(values, fast);
  const slowNow = sma(values, slow);
  const fastBefore = sma(previous, fast);
  const slowBefore = sma(previous, slow);

  if (fastNow === null || slowNow === null || fastBefore === null || slowBefore === null) return null;

  if (fastBefore <= slowBefore && fastNow > slowNow) return "golden_cross";
  if (fastBefore >= slowBefore && fastNow < slowNow) return "death_cross";
  return "none";
}

export type DirectionalMovement = {
  /** Trendstärke, 0–100. Sagt nichts über die Richtung. */
  adx: number;
  plusDi: number;
  minusDi: number;
};

/**
 * Average Directional Index nach Wilder.
 *
 * Der ADX misst **nur die Stärke** eines Trends, nicht seine Richtung — ein
 * ADX von 40 kann einen kräftigen Aufwärts- oder Abwärtstrend bedeuten. Deshalb
 * werden +DI und −DI mitgegeben; ohne sie ist die Zahl regelmäßig fehlgedeutet.
 *
 * Braucht `2 × period + 1` Kerzen: einmal für die Glättung der gerichteten
 * Bewegung, einmal für die Glättung des daraus gebildeten DX.
 */
export function adx(candles: readonly Candle[], period = 14): DirectionalMovement | null {
  if (period < 2 || candles.length < period * 2 + 1) return null;

  const trueRanges: number[] = [];
  const plusMoves: number[] = [];
  const minusMoves: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];

    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    // Nur die groessere der beiden Bewegungen zaehlt. Beide gleichzeitig zu
    // werten wuerde eine Innenkerze als gerichtet ausgeben.
    plusMoves.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusMoves.push(downMove > upMove && downMove > 0 ? downMove : 0);

    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  if (trueRanges.length < period * 2) return null;

  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

  let smoothedTr = total(trueRanges.slice(0, period));
  let smoothedPlus = total(plusMoves.slice(0, period));
  let smoothedMinus = total(minusMoves.slice(0, period));

  const directionalIndex = () => {
    // Eine wahre Spanne von null heisst: der Kurs hat sich nicht bewegt. Kein
    // gerichteter Anteil ist dann die Messung, keine Verlegenheitsloesung.
    if (smoothedTr === 0) return 0;
    const plus = (100 * smoothedPlus) / smoothedTr;
    const minus = (100 * smoothedMinus) / smoothedTr;
    const spread = plus + minus;
    return spread === 0 ? 0 : (100 * Math.abs(plus - minus)) / spread;
  };

  const dxValues: number[] = [directionalIndex()];

  for (let index = period; index < trueRanges.length; index += 1) {
    smoothedTr = smoothedTr - smoothedTr / period + trueRanges[index];
    smoothedPlus = smoothedPlus - smoothedPlus / period + plusMoves[index];
    smoothedMinus = smoothedMinus - smoothedMinus / period + minusMoves[index];
    dxValues.push(directionalIndex());
  }

  if (dxValues.length < period) return null;

  let value = total(dxValues.slice(0, period)) / period;
  for (const dx of dxValues.slice(period)) {
    value = (value * (period - 1) + dx) / period;
  }

  return {
    adx: value,
    plusDi: smoothedTr === 0 ? 0 : (100 * smoothedPlus) / smoothedTr,
    minusDi: smoothedTr === 0 ? 0 : (100 * smoothedMinus) / smoothedTr
  };
}

export type TrendChannel = {
  direction: "up" | "down" | "sideways";
  /** Obere und untere Kanalgrenze am aktuellen Rand. */
  upper: number;
  lower: number;
  /** Die Regressionsgerade am aktuellen Rand. */
  middle: number;
  /** Gesamtbewegung über das Fenster in Prozent. */
  changePercent: number;
  /**
   * Bestimmtheitsmaß 0–1.
   *
   * Der wichtigste Wert der ganzen Struktur: eine Regressionsgerade durch
   * reines Rauschen hat ebenfalls eine Steigung. Ohne diese Zahl sähe ein
   * Zufallsverlauf aus wie ein Trendkanal.
   */
  fit: number;
  /** Ob die Gerade den Verlauf gut genug beschreibt, um Kanal genannt zu werden. */
  reliable: boolean;
};

/** Ab welcher Güte von einem Kanal statt von einer Gerade gesprochen wird. */
const MIN_CHANNEL_FIT = 0.5;

/**
 * Trendkanal aus einer Regressionsgeraden.
 *
 * Die Kanalbreite ist die Streuung der Abweichungen von der Geraden — der
 * Kanal ist damit eng, wenn der Verlauf der Geraden folgt, und weit, wenn
 * nicht. `fit` und `reliable` gehören zwingend mit angezeigt.
 */
export function trendChannel(
  values: readonly number[],
  period = 60,
  deviations = 2
): TrendChannel | null {
  if (period < 3 || values.length < period) return null;

  const window = values.slice(-period);
  const count = window.length;
  const meanIndex = (count - 1) / 2;
  const meanValue = window.reduce((sum, value) => sum + value, 0) / count;

  let covariance = 0;
  let indexVariance = 0;
  let valueVariance = 0;

  for (let index = 0; index < count; index += 1) {
    const deltaIndex = index - meanIndex;
    const deltaValue = window[index] - meanValue;
    covariance += deltaIndex * deltaValue;
    indexVariance += deltaIndex * deltaIndex;
    valueVariance += deltaValue * deltaValue;
  }

  if (indexVariance === 0) return null;

  const slope = covariance / indexVariance;
  const intercept = meanValue - slope * meanIndex;

  let residualSquares = 0;
  for (let index = 0; index < count; index += 1) {
    const residual = window[index] - (intercept + slope * index);
    residualSquares += residual * residual;
  }

  const spread = Math.sqrt(residualSquares / count);
  // Ein waagerechter Verlauf hat keine erklaerbare Varianz. Die Guete ist dann
  // 0 und nicht 1 -- eine perfekte Gerade durch eine Gerade sagt nichts.
  const fit = valueVariance === 0 ? 0 : Math.max(0, 1 - residualSquares / valueVariance);
  const middle = intercept + slope * (count - 1);
  const changePercent = meanValue === 0 ? 0 : ((slope * (count - 1)) / meanValue) * 100;

  return {
    // Unter 3 % Gesamtbewegung ueber das Fenster ist die Richtung nicht
    // aussagekraeftig, egal wie gut die Gerade passt.
    direction: changePercent > 3 ? "up" : changePercent < -3 ? "down" : "sideways",
    upper: middle + deviations * spread,
    lower: middle - deviations * spread,
    middle,
    changePercent,
    fit,
    reliable: fit >= MIN_CHANNEL_FIT
  };
}

export type BreakoutResult =
  | { status: "none" }
  | {
      status: "breakout";
      direction: "up" | "down";
      /** Das durchbrochene Niveau. */
      level: number;
      /** Wie weit darüber hinaus, gemessen in ATR — vergleichbar zwischen Werten. */
      strengthInAtr: number;
      /** Ob das Volumen den Ausbruch stützt. */
      volumeConfirmed: boolean;
    };

/**
 * Ausbruch aus der Spanne der Vorperioden.
 *
 * `null` und `{ status: "none" }` sind bewusst verschieden: das eine heißt
 * „lässt sich nicht sagen", das andere „kein Ausbruch". Beides in `null`
 * zusammenzufassen wäre die Sorte Unschärfe, die später als Aussage gelesen
 * wird.
 *
 * Die Stärke wird in ATR gemessen und nicht in Prozent, damit ein Ausbruch bei
 * einem ruhigen und einem volatilen Wert vergleichbar bleibt. Ein Zehntel-ATR
 * über dem Hoch ist Rauschen, kein Ausbruch.
 */
export function breakout(
  candles: readonly Candle[],
  lookback = 20,
  minStrengthInAtr = 0.25
): BreakoutResult | null {
  if (lookback < 2 || candles.length < lookback + 15) return null;

  const range = atr(candles);
  if (range === null || range <= 0) return null;

  const prior = candles.slice(-lookback - 1, -1);
  const current = candles[candles.length - 1];
  const highest = Math.max(...prior.map((candle) => candle.high));
  const lowest = Math.min(...prior.map((candle) => candle.low));

  const averageVolume = prior.reduce((sum, candle) => sum + candle.volume, 0) / prior.length;
  // Ohne Volumendaten wird nichts bestaetigt -- und auch nichts widerlegt.
  const volumeConfirmed = averageVolume > 0 && current.volume > averageVolume * 1.5;

  if (current.close > highest) {
    const strengthInAtr = (current.close - highest) / range;
    if (strengthInAtr < minStrengthInAtr) return { status: "none" };
    return { status: "breakout", direction: "up", level: highest, strengthInAtr, volumeConfirmed };
  }

  if (current.close < lowest) {
    const strengthInAtr = (lowest - current.close) / range;
    if (strengthInAtr < minStrengthInAtr) return { status: "none" };
    return { status: "breakout", direction: "down", level: lowest, strengthInAtr, volumeConfirmed };
  }

  return { status: "none" };
}

export type IndicatorSet = {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: MacdResult | null;
  bollinger: BollingerBands | null;
  atr14: number | null;
  stochastic: Stochastic | null;
  roc12: number | null;
  obv: { value: number; risingShare: number } | null;
  vwap: number | null;
  volatility: number | null;
  supportResistance: SupportResistance | null;
  cross: MovingAverageCross | null;
  adx14: DirectionalMovement | null;
  trendChannel: TrendChannel | null;
  breakout: BreakoutResult | null;
  /** Wie viele Kerzen zur Verfügung standen. Bestimmt, was überhaupt ging. */
  sampleSize: number;
  /** Indikatoren, für die die Reihe zu kurz war — namentlich. */
  unavailable: string[];
};

/** Berechnet alles, was die Länge der Reihe hergibt. */
export function computeIndicators(candles: readonly Candle[]): IndicatorSet {
  const values = closes(candles);

  const set: Omit<IndicatorSet, "unavailable"> = {
    sma20: sma(values, 20),
    sma50: sma(values, 50),
    sma200: sma(values, 200),
    ema12: ema(values, 12),
    ema26: ema(values, 26),
    rsi14: rsi(values, 14),
    macd: macd(values),
    bollinger: bollingerBands(values),
    atr14: atr(candles),
    stochastic: stochastic(candles),
    roc12: roc(values),
    obv: obv(candles),
    vwap: vwap(candles),
    volatility: volatility(values),
    supportResistance: supportResistance(candles),
    cross: movingAverageCross(values),
    adx14: adx(candles),
    trendChannel: trendChannel(values),
    breakout: breakout(candles),
    sampleSize: candles.length
  };

  const unavailable = Object.entries(set)
    .filter(([key, value]) => key !== "sampleSize" && value === null)
    .map(([key]) => key);

  return { ...set, unavailable };
}
