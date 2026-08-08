import { describe, expect, it } from "vitest";
import { VERIFIED_BOOTSTRAP_SYMBOLS, selectForecastCoverage } from "./forecast-coverage";
import type { CoverageCandidate } from "./forecast-coverage";

const now = new Date("2026-08-07T12:00:00.000Z");

function candidate(overrides: Partial<CoverageCandidate> = {}): CoverageCandidate {
  return {
    symbol: "AAPL",
    quoteStatus: "available",
    confirmationCount: 5,
    lastForecastAt: null,
    ...overrides
  };
}

describe("selectForecastCoverage", () => {
  it("waehlt nur Instrumente mit bestaetigter Kursverfuegbarkeit", () => {
    const selection = selectForecastCoverage(
      [
        candidate({ symbol: "AAPL", quoteStatus: "available" }),
        candidate({ symbol: "QQQ", quoteStatus: "restricted" }),
        candidate({ symbol: "XYZ", quoteStatus: "unknown" }),
        candidate({ symbol: "ABC", quoteStatus: "error" })
      ],
      { now }
    );

    expect(selection.symbols).toEqual(["AAPL"]);
    expect(selection.skipped.notEntitled).toBe(1);
    expect(selection.skipped.unverified).toBe(2);
  });

  it("erzeugt keine Prognose fuer ein im Tarif gesperrtes Instrument", () => {
    // Sonst entstuenden Ledger-Eintraege, die zwangslaeufig als
    // insufficient_data enden und die Bewertungsquote druecken.
    const selection = selectForecastCoverage([candidate({ symbol: "QQQ", quoteStatus: "restricted" })], {
      now
    });

    expect(selection.symbols).toHaveLength(0);
    expect(selection.reason).toMatch(/ohne Kurs/i);
  });

  it("ueberspringt Instrumente mit frischer Prognose", () => {
    const selection = selectForecastCoverage(
      [
        candidate({ symbol: "AAPL", lastForecastAt: "2026-08-07T06:00:00.000Z" }),
        candidate({ symbol: "MSFT", lastForecastAt: "2026-08-05T06:00:00.000Z" })
      ],
      { now }
    );

    expect(selection.symbols).toEqual(["MSFT"]);
    expect(selection.skipped.recentlyForecast).toBe(1);
  });

  it("haelt die Budgetgrenze ein und meldet den Ueberhang", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      candidate({ symbol: `SYM${index}`, confirmationCount: index })
    );
    const selection = selectForecastCoverage(many, { now, batchSize: 10 });

    expect(selection.symbols).toHaveLength(10);
    expect(selection.skipped.overBudget).toBe(20);
    // Haeufiger bestaetigte zuerst.
    expect(selection.symbols[0]).toBe("SYM29");
  });

  it("dedupliziert Symbole", () => {
    const selection = selectForecastCoverage(
      [candidate({ symbol: "AAPL" }), candidate({ symbol: "aapl" }), candidate({ symbol: " AAPL " })],
      { now }
    );

    expect(selection.symbols).toEqual(["AAPL"]);
  });

  it("nutzt die geprüfte Bootstrap-Liste, solange der Master leer ist", () => {
    const selection = selectForecastCoverage([], { now });

    expect(selection.usedBootstrap).toBe(true);
    expect(selection.symbols).toEqual([...VERIFIED_BOOTSTRAP_SYMBOLS]);
    // Der Hinweis muss klarstellen, dass das kein Universum ist.
    expect(selection.reason).toMatch(/kein Universum/i);
  });

  it("laesst sich den Bootstrap abschalten", () => {
    const selection = selectForecastCoverage([], { now, allowBootstrap: false });

    expect(selection.usedBootstrap).toBe(false);
    expect(selection.symbols).toHaveLength(0);
  });

  it("nutzt keinen Bootstrap, sobald der Master Kandidaten hat", () => {
    const selection = selectForecastCoverage([candidate({ symbol: "NVDA" })], { now });

    expect(selection.usedBootstrap).toBe(false);
    expect(selection.symbols).toEqual(["NVDA"]);
  });

  it("meldet klar, wenn alle Kandidaten bereits aktuell sind", () => {
    const selection = selectForecastCoverage(
      [candidate({ symbol: "AAPL", lastForecastAt: "2026-08-07T06:00:00.000Z" })],
      { now }
    );

    expect(selection.symbols).toHaveLength(0);
    expect(selection.reason).toMatch(/bereits eine aktuelle Prognose/i);
  });

  it("haelt einen unbrauchbaren Zeitstempel nicht faelschlich fuer frisch", () => {
    const selection = selectForecastCoverage([candidate({ lastForecastAt: "kein-datum" })], { now });

    expect(selection.symbols).toEqual(["AAPL"]);
  });

  it("begrenzt die Batchgroesse auf einen sinnvollen Bereich", () => {
    const many = Array.from({ length: 200 }, (_, index) => candidate({ symbol: `S${index}` }));

    expect(selectForecastCoverage(many, { now, batchSize: 5000 }).symbols).toHaveLength(100);
    expect(selectForecastCoverage(many, { now, batchSize: 0 }).symbols).toHaveLength(1);
  });
});
