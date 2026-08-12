/**
 * Datenvertrag für historische Preisreihen.
 *
 * Das Modul ist absichtlich rein: Provider beschaffen Daten, diese Funktionen
 * bewerten ausschließlich, was tatsächlich geliefert wurde. Damit kann weder
 * ein API-Fehler noch ein UI-Default aus einer Rohreihe eine angeblich
 * Corporate-Action-bereinigte Point-in-Time-Historie machen.
 */

export type HistoricalPriceBasis =
  | "adjusted_ohlc"
  | "adjusted_close"
  | "unadjusted_close"
  | "mixed"
  | "unknown";

export type HistoricalBacktestStatus = "usable_with_limitations" | "blocked";

export interface HistoricalDataIntegrity {
  priceBasis: HistoricalPriceBasis;
  backtestStatus: HistoricalBacktestStatus;
  adjustedCloseCoveragePercent: number | null;
  adjustedOhlcCoveragePercent: number | null;
  ohlcAdjustmentType:
    | "RAW"
    | "SPLIT_ADJUSTED"
    | "DIVIDEND_ADJUSTED"
    | "SPLIT_DIVIDEND_ADJUSTED"
    | null;
  corporateActionAdjustment:
    | "split_adjusted_ohlc"
    | "dividend_adjusted_ohlc"
    | "split_dividend_adjusted_ohlc"
    | "provider_adjusted_close"
    | "not_evidenced"
    | "inconsistent"
    | "unknown";
  pointInTime: false;
  pointInTimeStatus: "current_snapshot_only";
  dataCutoff: string | null;
  receivedAt: string;
  timezone: "UTC";
  issues: string[];
}

type HistoricalObservation = {
  timestamp: string;
  close: number;
  adjustedClose?: number;
  isAdjusted?: boolean;
  adjustmentType?:
    | "RAW"
    | "SPLIT_ADJUSTED"
    | "DIVIDEND_ADJUSTED"
    | "SPLIT_DIVIDEND_ADJUSTED";
};

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function assessHistoricalDataIntegrity(
  candles: readonly HistoricalObservation[],
  receivedAt = new Date().toISOString()
): HistoricalDataIntegrity {
  const usable = candles.filter(
    (candle) =>
      Number.isFinite(new Date(candle.timestamp).getTime()) && isPositiveFinite(candle.close)
  );
  const adjustedCount = usable.filter((candle) => isPositiveFinite(candle.adjustedClose)).length;
  const adjustedOhlc = usable.filter((candle) => candle.isAdjusted === true);
  const adjustedOhlcCount = adjustedOhlc.length;
  const adjustedOhlcTypes = new Set(
    adjustedOhlc.map((candle) => candle.adjustmentType).filter(
      (type): type is NonNullable<HistoricalObservation["adjustmentType"]> =>
        type !== undefined,
    ),
  );
  const contradictoryAdjustment = usable.some(
    (candle) =>
      (candle.isAdjusted === true && candle.adjustmentType === "RAW") ||
      (candle.isAdjusted === false && candle.adjustmentType !== undefined && candle.adjustmentType !== "RAW"),
  );
  const latest = usable.reduce<string | null>((current, candle) => {
    if (current === null) return candle.timestamp;
    return new Date(candle.timestamp).getTime() > new Date(current).getTime()
      ? candle.timestamp
      : current;
  }, null);

  const common = {
    pointInTime: false as const,
    pointInTimeStatus: "current_snapshot_only" as const,
    dataCutoff: latest,
    receivedAt,
    timezone: "UTC" as const
  };

  if (usable.length === 0) {
    return {
      ...common,
      priceBasis: "unknown",
      backtestStatus: "blocked",
      adjustedCloseCoveragePercent: null,
      adjustedOhlcCoveragePercent: null,
      ohlcAdjustmentType: null,
      corporateActionAdjustment: "unknown",
      issues: [
        "Keine verwertbare historische Preisreihe vorhanden.",
        "Keine Point-in-Time-Vintages vorhanden."
      ]
    };
  }

  if (
    contradictoryAdjustment ||
    (adjustedOhlcCount > 0 && adjustedOhlcCount < usable.length) ||
    adjustedOhlcTypes.size > 1
  ) {
    return {
      ...common,
      priceBasis: "mixed",
      backtestStatus: "blocked",
      adjustedCloseCoveragePercent: Math.round((adjustedCount / usable.length) * 100),
      adjustedOhlcCoveragePercent: Math.round((adjustedOhlcCount / usable.length) * 100),
      ohlcAdjustmentType: null,
      corporateActionAdjustment: "inconsistent",
      issues: [
        "Die Reihe mischt rohe und angepasste OHLC-Werte oder unterschiedliche Anpassungsarten. Ein Backtest wäre methodisch inkonsistent.",
        "Keine Point-in-Time-Vintages vorhanden."
      ]
    };
  }

  if (adjustedOhlcCount === usable.length) {
    const adjustmentType = adjustedOhlc[0]?.adjustmentType;
    if (!adjustmentType || adjustmentType === "RAW") {
      return {
        ...common,
        priceBasis: "mixed",
        backtestStatus: "blocked",
        adjustedCloseCoveragePercent: Math.round((adjustedCount / usable.length) * 100),
        adjustedOhlcCoveragePercent: 100,
        ohlcAdjustmentType: null,
        corporateActionAdjustment: "inconsistent",
        issues: [
          "Die OHLC-Reihe ist als angepasst markiert, aber die Anpassungsart ist nicht belastbar ausgewiesen.",
          "Keine Point-in-Time-Vintages vorhanden."
        ]
      };
    }
    const corporateActionAdjustment = adjustmentType === "SPLIT_ADJUSTED"
      ? "split_adjusted_ohlc" as const
      : adjustmentType === "DIVIDEND_ADJUSTED"
        ? "dividend_adjusted_ohlc" as const
        : "split_dividend_adjusted_ohlc" as const;
    return {
      ...common,
      priceBasis: "adjusted_ohlc",
      backtestStatus: "usable_with_limitations",
      adjustedCloseCoveragePercent: Math.round((adjustedCount / usable.length) * 100),
      adjustedOhlcCoveragePercent: 100,
      ohlcAdjustmentType: adjustmentType,
      corporateActionAdjustment,
      issues: [
        `Die OHLC-Reihe ist als ${adjustmentType} gekennzeichnet; die Anpassungen wurden nicht gegen einen unabhängigen Corporate-Action-Ledger abgeglichen.`,
        "Die Reihe ist ein aktueller historischer Snapshot, keine Point-in-Time-Vintage. Survivorship- und Selection-Bias bleiben möglich."
      ]
    };
  }

  if (adjustedCount > 0 && adjustedCount < usable.length) {
    return {
      ...common,
      priceBasis: "mixed",
      backtestStatus: "blocked",
      adjustedCloseCoveragePercent: Math.round((adjustedCount / usable.length) * 100),
      adjustedOhlcCoveragePercent: 0,
      ohlcAdjustmentType: "RAW",
      corporateActionAdjustment: "inconsistent",
      issues: [
        "Die Reihe mischt angepasste und nicht angepasste Schlusskurse. Eine Rendite daraus wäre methodisch inkonsistent.",
        "Keine Point-in-Time-Vintages vorhanden."
      ]
    };
  }

  if (adjustedCount === usable.length) {
    return {
      ...common,
      priceBasis: "adjusted_close",
      backtestStatus: "usable_with_limitations",
      adjustedCloseCoveragePercent: 100,
      adjustedOhlcCoveragePercent: 0,
      ohlcAdjustmentType: "RAW",
      corporateActionAdjustment: "provider_adjusted_close",
      issues: [
        "Der Anbieter liefert einen Adjusted-Close-Wert; Art und Vollständigkeit der Anpassungen wurden nicht gegen einen unabhängigen Corporate-Action-Ledger abgeglichen.",
        "Die Reihe ist ein aktueller historischer Snapshot, keine Point-in-Time-Vintage. Survivorship- und Selection-Bias bleiben möglich."
      ]
    };
  }

  return {
    ...common,
    priceBasis: "unadjusted_close",
    backtestStatus: "usable_with_limitations",
    adjustedCloseCoveragePercent: 0,
    adjustedOhlcCoveragePercent: 0,
    ohlcAdjustmentType: "RAW",
    corporateActionAdjustment: "not_evidenced",
    issues: [
      "Keine nachweislich um Splits, Ausschüttungen oder andere Corporate Actions angepasste Schlusskursreihe vorhanden.",
      "Die Reihe ist ein aktueller historischer Snapshot, keine Point-in-Time-Vintage. Survivorship- und Selection-Bias bleiben möglich."
    ]
  };
}

export function historicalPriceBasisLabel(priceBasis: HistoricalPriceBasis): string {
  if (priceBasis === "adjusted_ohlc") return "Explizit angepasste OHLC-Reihe";
  if (priceBasis === "adjusted_close") return "Adjusted Close des Anbieters";
  if (priceBasis === "unadjusted_close") return "Nicht nachweislich angepasst";
  if (priceBasis === "mixed") return "Inkonsistente Mischreihe";
  return "Nicht feststellbar";
}
