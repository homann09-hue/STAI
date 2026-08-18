import { describe, expect, it } from "vitest";
import { toEcbDataLifecycle } from "@/lib/macro/ecb-reading";
import { findMacroSeries, macroSeriesCatalog, macroSeriesUrl } from "@/lib/macro/series";

describe("ECB-Lebenszyklus", () => {
  it("normalisiert die vom SDMX-Dienst belegten Felder", () => {
    const series = findMacroSeries("ea_inflation_hicp");
    if (!series) throw new Error("HVPI-Reihe fehlt");
    expect(toEcbDataLifecycle([{
      period: "2026-01",
      value: 1.9,
      releaseTime: "2026-02-10T09:00:00.000Z",
      vintageAsOf: "2026-03-10T09:00:00.000Z",
      initialValue: 1.8,
      revisionState: "revised"
    }], series)).toMatchObject({
      seriesKey: "ICP.M.U2.N.000000.4.ANR",
      frequency: "monthly",
      unit: "percent",
      region: "euro_area",
      provider: "ECB Data Portal",
      observationTime: "2026-01",
      revisionState: "revised",
      revisionDelta: 0.1
    });
  });

  it("enthält die offiziell verifizierten Kredit- und Liquiditätsreihen", () => {
    expect(macroSeriesCatalog.map((series) => series.id)).toEqual(expect.arrayContaining([
      "ea_bank_loans_nfc",
      "ea_excess_liquidity"
    ]));
  });

  it("fordert die SDMX-Historie statt nur aktueller Werte an", () => {
    const series = findMacroSeries("ea_excess_liquidity");
    if (!series) throw new Error("Liquiditätsreihe fehlt");
    const url = macroSeriesUrl(series, 24);
    expect(url.searchParams.get("detail")).toBe("full");
    expect(url.searchParams.get("includeHistory")).toBe("true");
  });
});
