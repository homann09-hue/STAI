import { describe, expect, it } from "vitest";
import { buildRiskReport } from "@/lib/risk-engine";
import { NO_INDICATORS } from "@/lib/analysis/technical";
import { chartRanges, type Candle, type DataQualityReport, type TimeRange } from "@/lib/types";

/**
 * Vor dieser Änderung konnte die Risiko-Engine nie zu wenige Kerzen haben:
 * `candlesFromQuote` erzeugte immer 32 Stück je Zeitfenster, aus einem
 * einzigen Kurs und einer Sinusfunktion. Momentum- und Volumenbefunde
 * entstanden daraus mit Belegen wie „1M-Bewegung 4,20 %".
 *
 * Diese Tests halten fest, was jetzt gilt: ohne Historie keine technische
 * Aussage — und das Fehlen selbst wird gemeldet.
 */

function candle(close: number, index: number, volume = 1_000_000): Candle {
  return {
    symbol: "TEST",
    range: "1M",
    timestamp: new Date(Date.UTC(2026, 6, 1 + index)).toISOString(),
    time: "",
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume
  };
}

function emptyRanges(): Record<TimeRange, Candle[]> {
  return Object.fromEntries(chartRanges.map((range) => [range, [] as Candle[]])) as Record<
    TimeRange,
    Candle[]
  >;
}

type RiskInput = Parameters<typeof buildRiskReport>[0];

function detail(candles: Candle[]): RiskInput {
  const ranges = emptyRanges();
  ranges["1M"] = candles;

  return {
    asset: { symbol: "TEST", name: "Test", type: "stock", currency: "USD", exchange: "TEST" },
    quote: { price: 100, changePercent: 0.5, volume: 20_000_000 },
    candles: ranges,
    indicators: NO_INDICATORS,
    news: [],
    earningsDate: null,
    professionalScores: { volatilityRisk: 10 },
    analysisLayers: [],
    macroFactors: []
  } as unknown as RiskInput;
}

// Vollstaendig getippt und nicht gecastet. Ein `as never` hatte beim ersten
// Versuch verdeckt, dass `warnings` fehlt -- der Test scheiterte dann an
// meinem Fixture statt am Code.
const quality: DataQualityReport = {
  score: 80,
  freshness: "fresh",
  sourceLabel: "Test",
  isMock: false,
  updatedAt: "2026-08-08T10:00:00.000Z",
  stale: false,
  sufficientForAnalysis: true,
  confidence: 80,
  issues: [],
  warnings: [],
  contradictions: [],
  sources: []
};

describe("Risiko-Engine ohne Kurshistorie", () => {
  it("meldet das Fehlen der Historie als eigenen Befund", () => {
    // Der Kern: ein Instrument ohne Daten darf nicht aussehen wie eines ohne
    // Risiken. Das waere der gefaehrlichste Trugschluss dieser Engine.
    const report = buildRiskReport(detail([]), quality, new Date("2026-08-08T10:00:00Z"));
    const missing = report.findings.find((entry) => entry.id === "history-missing");

    expect(missing).toBeDefined();
    expect(missing?.evidence).toContain("0 Kerzen");
    expect(missing?.action).toContain("nicht als Abwesenheit von Risiko");
  });

  it("erzeugt ohne Historie keine Trend- oder Volumenbefunde", () => {
    const report = buildRiskReport(detail([]), quality, new Date("2026-08-08T10:00:00Z"));
    const ids = report.findings.map((entry) => entry.id);

    expect(ids).not.toContain("volatility-high");
    expect(ids).not.toContain("volume-falling");
  });

  it("hält eine zu kurze Reihe für zu kurz", () => {
    // Fuenf Kerzen sind kein Monatstrend. Vorher gab es diese Grenze nicht,
    // weil die Kerzenzahl fest war.
    const report = buildRiskReport(
      detail(Array.from({ length: 5 }, (_, index) => candle(100 + index, index))),
      quality,
      new Date("2026-08-08T10:00:00Z")
    );

    expect(report.findings.some((entry) => entry.id === "history-missing")).toBe(true);
  });

  it("urteilt bei ausreichender Historie wieder", () => {
    // Starke Bewegung bei fallendem Volumen -- der Befund, der vorher aus
    // erzeugten Kerzen entstand, entsteht jetzt aus echten.
    const rising = Array.from({ length: 20 }, (_, index) =>
      candle(100 + index * 2, index, index < 12 ? 5_000_000 : 1_000_000)
    );
    const report = buildRiskReport(detail(rising), quality, new Date("2026-08-08T10:00:00Z"));
    const ids = report.findings.map((entry) => entry.id);

    expect(ids).not.toContain("history-missing");
    expect(ids).toContain("volume-falling");
  });
});
