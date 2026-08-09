/**
 * Backtest auf echten Tageskursen.
 *
 * Vorher hieß `/backtesting` so, war aber ein Zinseszinsrechner: die Rendite
 * gab der Nutzer selbst ein, das Bär/Bull-Band war `vol × √Jahr × 0,62` und der
 * Drawdown `vol × 1,8`. Kein historischer Kurs berührte die Seite. Nach §90 ist
 * das eine Fassade — der Name versprach eine Prüfung an der Vergangenheit, und
 * geliefert wurde eine Fortschreibung der eigenen Annahme.
 *
 * Reine Rechnung, kein Netzzugriff. Die Kerzen kommen von außen.
 *
 * ## Zwei Renditen, und warum beide dastehen
 *
 * Bei einem Sparplan gibt es **nicht die eine** Rendite:
 *
 * - Die **zeitgewichtete** Rendite misst die Strategie. Sie ist unabhängig
 *   davon, wann Geld eingezahlt wurde.
 * - Die **geldgewichtete** Rendite (interner Zinsfuß) misst, was der Anleger
 *   tatsächlich verdient hat. Sie hängt am Einzahlungsplan.
 *
 * Beide können weit auseinanderliegen. Nur eine davon auszugeben und sie
 * „Rendite" zu nennen wäre die Sorte Scheingenauigkeit, die §38 verbietet.
 */

export type BacktestCandle = {
  /** ISO-Zeitpunkt der Kerze. */
  timestamp: string;
  close: number;
};

export type BacktestInput = {
  candles: readonly BacktestCandle[];
  /** Einmalige Anlage zu Beginn. */
  initialCapital: number;
  /** Zusätzliche Einzahlung, jeweils am ersten Handelstag eines Monats. */
  monthlyContribution: number;
};

export type BacktestCashflow = {
  date: string;
  amount: number;
};

export type BacktestPoint = {
  date: string;
  /** Depotwert an diesem Tag. */
  value: number;
  /** Summe aller bis dahin eingezahlten Beträge. */
  invested: number;
};

export type BacktestResult = {
  ok: true;
  symbolPoints: number;
  from: string;
  to: string;
  years: number;
  curve: BacktestPoint[];
  /** Was insgesamt eingezahlt wurde. */
  invested: number;
  /** Was am Ende da ist. */
  finalValue: number;
  profit: number;
  /**
   * Zeitgewichtete Jahresrendite der Strategie.
   *
   * Das ist die Rendite des Instruments über den Zeitraum, unabhängig vom
   * Einzahlungsplan — die Zahl, mit der man Strategien vergleicht.
   */
  timeWeightedCagr: number;
  /**
   * Geldgewichtete Jahresrendite (interner Zinsfuß).
   *
   * Das ist die Rendite dieses konkreten Sparplans. `null`, wenn die
   * Zahlungsreihe keine eindeutige Lösung hat.
   */
  moneyWeightedIrr: number | null;
  /**
   * Größter Rückgang vom Hoch, gemessen am **Kursverlauf**.
   *
   * Bewusst nicht am Depotwert: laufende Einzahlungen heben ihn an und würden
   * einen realen Einbruch optisch verkleinern. Ein Sparplan, der mitten im
   * Absturz weiter kauft, sähe sonst aus, als hätte es den Absturz kaum
   * gegeben.
   */
  maxDrawdown: number;
  maxDrawdownFrom: string;
  maxDrawdownTo: string;
  /** Annualisierte Standardabweichung der Tagesrenditen. */
  volatility: number;
  /** Beste und schlechteste Kalenderjahre im Zeitraum. */
  bestYear: { year: number; changePercent: number } | null;
  worstYear: { year: number; changePercent: number } | null;
  /** Was an dieser Rechnung nicht enthalten ist. Gehört in die Anzeige. */
  caveats: string[];
};

export type BacktestRefusal = {
  ok: false;
  reason: string;
};

/**
 * Weniger als zwei Jahre Tageskurse ergeben keinen Backtest.
 *
 * Eine Jahresrendite aus acht Monaten hochzurechnen ist genau der Fehler, den
 * §38 „keine Scheingenauigkeit" meint: das Ergebnis sieht aus wie eine
 * Kennzahl und ist eine Extrapolation.
 */
export const MIN_CANDLES = 500;

/** Ab wann eine Jahresangabe ein volles Jahr abdeckt. */
const MIN_TRADING_DAYS_PER_YEAR = 200;

const TRADING_DAYS_PER_YEAR = 252;

function annualisedFromDaily(dailyReturns: readonly number[]): number {
  if (dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (dailyReturns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}

/**
 * Interner Zinsfuß über Bisektion.
 *
 * Kein Newton-Verfahren: die Zahlungsreihe eines Sparplans kann mehrere
 * Vorzeichenwechsel haben, und Newton läuft dann gern gegen eine Lösung, die
 * wirtschaftlich unsinnig ist. Bisektion über einem festen Intervall findet
 * entweder eine Lösung darin oder gibt zu, dass sie keine hat.
 */
export function internalRateOfReturn(
  cashflows: readonly BacktestCashflow[],
  finalValue: number,
  finalDate: string
): number | null {
  if (cashflows.length === 0) return null;

  const start = new Date(cashflows[0].date).getTime();
  const end = new Date(finalDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const flows = [
    ...cashflows.map((flow) => ({
      years: (new Date(flow.date).getTime() - start) / (365.25 * 86_400_000),
      amount: -flow.amount
    })),
    { years: (end - start) / (365.25 * 86_400_000), amount: finalValue }
  ];

  const npv = (rate: number) =>
    flows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** flow.years, 0);

  // Bis fast -100 % und bis +1000 % p.a. Die Untergrenze lag zuerst bei -99 %
  // -- damit fiel ein Totalverlust aus dem Suchintervall und wurde als "keine
  // Loesung" gemeldet. Genau der Fall, den ein Anleger am dringendsten
  // beziffert sehen will, war der einzige ohne Zahl.
  let low = -0.9999;
  let high = 10;

  if (npv(low) * npv(high) > 0) return null;

  for (let step = 0; step < 200; step += 1) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }

  const rate = ((low + high) / 2) * 100;
  return Number.isFinite(rate) ? rate : null;
}

/**
 * Rechnet einen Sparplan auf einer echten Kursreihe durch.
 *
 * Gekauft wird zum Schlusskurs des jeweiligen Tages — Bruchteile erlaubt.
 * Gebühren, Steuern, Spreads und Dividenden sind **nicht** enthalten; das steht
 * in `caveats` und nicht im Kleingedruckten, weil es das Ergebnis in beide
 * Richtungen deutlich verschiebt.
 */
export function runBacktest(input: BacktestInput): BacktestResult | BacktestRefusal {
  const candles = [...input.candles]
    .filter((candle) => Number.isFinite(candle.close) && candle.close > 0)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  if (candles.length < MIN_CANDLES) {
    return {
      ok: false,
      reason: `Für einen Backtest liegen ${candles.length} Tageskurse vor, nötig sind ${MIN_CANDLES} (rund zwei Jahre). Eine Jahresrendite aus einem kürzeren Zeitraum wäre eine Hochrechnung, keine Messung.`
    };
  }

  const initialCapital = Math.max(0, input.initialCapital);
  const monthlyContribution = Math.max(0, input.monthlyContribution);

  if (initialCapital <= 0 && monthlyContribution <= 0) {
    return { ok: false, reason: "Ohne Startkapital und ohne Einzahlung gibt es nichts zu rechnen." };
  }

  const cashflows: BacktestCashflow[] = [];
  const curve: BacktestPoint[] = [];

  let units = 0;
  let invested = 0;
  let lastMonth = "";

  for (const [index, candle] of candles.entries()) {
    const month = candle.timestamp.slice(0, 7);
    let payment = 0;

    if (index === 0) {
      payment = initialCapital;
    } else if (month !== lastMonth && monthlyContribution > 0) {
      // Erster Handelstag des Monats. Nicht der Erste des Kalendermonats: an
      // dem wird oft nicht gehandelt, und ein Kurs von einem Tag ohne Handel
      // waere erfunden.
      payment = monthlyContribution;
    }

    lastMonth = month;

    if (payment > 0) {
      units += payment / candle.close;
      invested += payment;
      cashflows.push({ date: candle.timestamp, amount: payment });
    }

    curve.push({ date: candle.timestamp, value: units * candle.close, invested });
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  const years = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (365.25 * 86_400_000);
  const finalValue = units * last.close;

  // Zeitgewichtet: die Rendite des Instruments, unabhaengig vom Einzahlungsplan.
  const timeWeightedCagr = years > 0 ? ((last.close / first.close) ** (1 / years) - 1) * 100 : 0;

  const dailyReturns = candles
    .slice(1)
    .map((candle, index) => candle.close / candles[index].close - 1);

  let peak = first.close;
  let peakDate = first.timestamp;
  let maxDrawdown = 0;
  let maxDrawdownFrom = first.timestamp;
  let maxDrawdownTo = first.timestamp;

  for (const candle of candles) {
    if (candle.close > peak) {
      peak = candle.close;
      peakDate = candle.timestamp;
    }
    const drawdown = (candle.close / peak - 1) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownFrom = peakDate;
      maxDrawdownTo = candle.timestamp;
    }
  }

  const caveats = [
    "Ohne Gebühren, Spreads und Steuern gerechnet. Beides verschiebt das Ergebnis nach unten.",
    "Ohne Dividenden und Ausschüttungen. Bei ausschüttenden Werten fällt die tatsächliche Rendite höher aus.",
    "Ein Backtest zeigt, was gewesen wäre. Er sagt nichts darüber, was sein wird."
  ];

  if (years < 5) {
    caveats.push(
      `Der Zeitraum umfasst ${years.toFixed(1)} Jahre. Er enthält damit nicht notwendigerweise einen vollständigen Marktzyklus.`
    );
  }

  return {
    ok: true,
    symbolPoints: candles.length,
    from: first.timestamp.slice(0, 10),
    to: last.timestamp.slice(0, 10),
    years,
    curve,
    invested,
    finalValue,
    profit: finalValue - invested,
    timeWeightedCagr,
    moneyWeightedIrr: internalRateOfReturn(cashflows, finalValue, last.timestamp),
    maxDrawdown,
    maxDrawdownFrom: maxDrawdownFrom.slice(0, 10),
    maxDrawdownTo: maxDrawdownTo.slice(0, 10),
    volatility: annualisedFromDaily(dailyReturns),
    ...calendarYearExtremes(candles),
    caveats
  };
}

/**
 * Bestes und schlechtestes Kalenderjahr.
 *
 * Angefangene Jahre am Rand des Zeitraums werden **übersprungen**. Ein
 * „schlechtestes Jahr" aus sechs Wochen Januar wäre eine Aussage über sechs
 * Wochen mit einer Jahreszahl davor.
 */
function calendarYearExtremes(candles: readonly BacktestCandle[]) {
  const byYear = new Map<number, BacktestCandle[]>();

  for (const candle of candles) {
    const year = new Date(candle.timestamp).getUTCFullYear();
    const bucket = byYear.get(year);
    if (bucket) bucket.push(candle);
    else byYear.set(year, [candle]);
  }

  const changes = [...byYear.entries()]
    .filter(([, entries]) => entries.length >= MIN_TRADING_DAYS_PER_YEAR)
    .map(([year, entries]) => ({
      year,
      changePercent: (entries[entries.length - 1].close / entries[0].close - 1) * 100
    }));

  if (changes.length === 0) return { bestYear: null, worstYear: null };

  return {
    bestYear: changes.reduce((best, entry) => (entry.changePercent > best.changePercent ? entry : best)),
    worstYear: changes.reduce((worst, entry) => (entry.changePercent < worst.changePercent ? entry : worst))
  };
}
