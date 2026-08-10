/**
 * Datenvertrag für historische Preisreihen.
 *
 * Das Modul ist absichtlich rein: Provider beschaffen Daten, diese Funktionen
 * bewerten ausschließlich, was tatsächlich geliefert wurde. Damit kann weder
 * ein API-Fehler noch ein UI-Default aus einer Rohreihe eine angeblich
 * Corporate-Action-bereinigte Point-in-Time-Historie machen.
 */

export type HistoricalPriceBasis =
  | "adjusted_close"
  | "unadjusted_close"
  | "mixed"
  | "unknown";

export type HistoricalBacktestStatus = "usable_with_limitations" | "blocked";

export interface HistoricalDataIntegrity {
  priceBasis: HistoricalPriceBasis;
  backtestStatus: HistoricalBacktestStatus;
  adjustedCloseCoveragePercent: number | null;
  corporateActionAdjustment:
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
      corporateActionAdjustment: "unknown",
      issues: [
        "Keine verwertbare historische Preisreihe vorhanden.",
        "Keine Point-in-Time-Vintages vorhanden."
      ]
    };
  }

  if (adjustedCount > 0 && adjustedCount < usable.length) {
    return {
      ...common,
      priceBasis: "mixed",
      backtestStatus: "blocked",
      adjustedCloseCoveragePercent: Math.round((adjustedCount / usable.length) * 100),
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
    corporateActionAdjustment: "not_evidenced",
    issues: [
      "Keine nachweislich um Splits, Ausschüttungen oder andere Corporate Actions angepasste Schlusskursreihe vorhanden.",
      "Die Reihe ist ein aktueller historischer Snapshot, keine Point-in-Time-Vintage. Survivorship- und Selection-Bias bleiben möglich."
    ]
  };
}

export function historicalPriceBasisLabel(priceBasis: HistoricalPriceBasis): string {
  if (priceBasis === "adjusted_close") return "Adjusted Close des Anbieters";
  if (priceBasis === "unadjusted_close") return "Nicht nachweislich angepasst";
  if (priceBasis === "mixed") return "Inkonsistente Mischreihe";
  return "Nicht feststellbar";
}
