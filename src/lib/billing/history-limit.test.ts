import { describe, expect, it } from "vitest";
import { limitCandleRanges, limitHistoryByYears } from "@/lib/billing/history-limit";

/**
 * §4 nennt `historicalDataYears` als Tariflimit — Free 1 Jahr, Pro 10, Premium
 * 20. Definiert war es lange, durchgesetzt hat es nichts.
 *
 * Die Lücke wurde durch `price-history.ts` größer: seitdem bekommt jeder Abruf
 * fünf Jahre Tageskerzen, ein Free-Konto also genauso viel wie ein
 * Premium-Konto. Ein Limit, das nichts begrenzt, ist nach §90 eine Fassade.
 */

const now = new Date("2026-08-09T12:00:00.000Z");

function candles(days: number) {
  return Array.from({ length: days }, (_, index) => ({
    timestamp: new Date(now.getTime() - index * 86_400_000).toISOString(),
    close: 100 + index
  }));
}

describe("Kürzung nach Tarif", () => {
  it("lässt einem Free-Konto ein Jahr", () => {
    // 1255 Kerzen sind rund fuenf Jahre -- genau das, was price-history liefert.
    const result = limitHistoryByYears(candles(1255), 1, now);

    expect(result.truncated).toBe(true);
    expect(result.candles.length).toBeLessThan(380);
    expect(result.candles.length).toBeGreaterThan(360);
  });

  it("lässt einem Premium-Konto alles", () => {
    const result = limitHistoryByYears(candles(1255), 20, now);

    expect(result.truncated).toBe(false);
    expect(result.candles).toHaveLength(1255);
    expect(result.note).toBeNull();
  });

  it("behält die jüngsten Kerzen, nicht die ältesten", () => {
    // Andersherum bekaeme ein Free-Konto das aelteste Jahr statt des aktuellen
    // -- dieselbe Menge, praktisch wertlos.
    const result = limitHistoryByYears(candles(1000), 1, now);
    const newest = new Date(result.candles[0].timestamp).getTime();
    const oldest = new Date(result.candles[result.candles.length - 1].timestamp).getTime();

    expect(newest).toBeGreaterThan(oldest);
    expect(now.getTime() - newest).toBeLessThan(2 * 86_400_000);
  });

  it("sagt dem Nutzer, dass gekürzt wurde", () => {
    // Eine stillschweigende Kuerzung waere schlimmer als gar keine Historie:
    // der Nutzer haelt ein Jahr fuer die gesamte Reihe.
    const result = limitHistoryByYears(candles(1255), 1, now);

    expect(result.note).toContain("1 Jahr");
    expect(result.note).toContain("nicht geladen");
  });

  it("schreibt die Mehrzahl richtig", () => {
    expect(limitHistoryByYears(candles(1255), 1, now).note).toContain("1 Jahr Kurshistorie");
    expect(limitHistoryByYears(candles(5000), 10, now).note).toContain("10 Jahre Kurshistorie");
  });
});

describe("Randfälle", () => {
  it("kürzt bei einem Limit von null gar nicht", () => {
    // Ein Tarif mit null Jahren waere ein Konfigurationsfehler. Dann ist es
    // besser, nichts abzuschneiden als alles.
    const result = limitHistoryByYears(candles(500), 0, now);

    expect(result.candles).toHaveLength(500);
    expect(result.truncated).toBe(false);
  });

  it("behält Kerzen ohne lesbares Datum", () => {
    // Sie wegzuwerfen waere eine Entscheidung ueber Daten, die man nicht
    // beurteilen kann.
    const result = limitHistoryByYears(
      [{ timestamp: "kein Datum" }, ...candles(1000)],
      1,
      now
    );

    expect(result.candles.some((candle) => candle.timestamp === "kein Datum")).toBe(true);
  });

  it("verträgt eine leere Reihe", () => {
    const result = limitHistoryByYears([], 1, now);

    expect(result.candles).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.note).toBeNull();
  });
});

describe("alle Zeitfenster", () => {
  it("kürzt jedes Fenster und meldet es einmal", () => {
    const result = limitCandleRanges(
      { "1M": candles(22), "1Y": candles(252), "5Y": candles(1255) },
      1,
      now
    );

    expect(result.ranges["1M"]).toHaveLength(22);
    expect(result.ranges["1Y"]).toHaveLength(252);
    expect(result.ranges["5Y"].length).toBeLessThan(380);
    expect(result.truncated).toBe(true);
  });

  it("blendet gekürzte Fenster nicht aus", () => {
    // Der Nutzer soll sehen, dass es das Fenster gibt und was ihm fehlt.
    const result = limitCandleRanges({ "5Y": candles(1255) }, 1, now);

    expect(result.ranges["5Y"].length).toBeGreaterThan(0);
    expect(result.note).toContain("weniger, als ihr Name verspricht");
  });

  it("meldet nichts, wenn nichts gekürzt wurde", () => {
    const result = limitCandleRanges({ "1M": candles(22) }, 20, now);

    expect(result.truncated).toBe(false);
    expect(result.note).toBeNull();
  });
});
