import { describe, expect, it } from "vitest";
import { assessDataQuality, validateAssetData } from "./data-quality";
import { getMockAsset } from "./mock/market";

type MockDetail = NonNullable<ReturnType<typeof getMockAsset>>;

describe("data quality branch coverage", () => {
  it("reports validation issues for incomplete market, news and fundamental data", () => {
    const detail = cloneDetail("NVDA");
    detail.quote.price = -1;
    detail.asset.name = "";
    detail.candles["1D"] = detail.candles["1D"].slice(0, 2);
    detail.news = [{ ...detail.news[0], id: "", relevance: 140 }];
    detail.fundamentals.peRatio = null;

    const validation = validateAssetData(detail);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        "Kursdaten sind unvollständig oder ungültig.",
        "Asset-Stammdaten fehlen.",
        "Mindestens ein Chart-Zeitraum hat zu wenige Kerzen.",
        "Mindestens eine News-Quelle ist unvollständig.",
        "KGV fehlt für ein nicht-krypto Asset."
      ])
    );
  });

  it("scores stale, delayed, unavailable, crypto and contradictory data states", () => {
    const stale = cloneDetail("NVDA");
    stale.quote.quality = "unavailable";
    stale.quote.asOf = "2026-06-30T08:00:00+02:00";
    stale.news = [];

    const staleReport = assessDataQuality(stale, new Date("2026-06-30T12:00:00+02:00"));
    expect(staleReport.freshness).toBe("stale");
    expect(staleReport.sourceLabel).toBe("Nicht verfügbar");
    expect(staleReport.sufficientForAnalysis).toBe(false);
    expect(staleReport.warnings).toEqual(
      expect.arrayContaining([
        "Kursanbieter ist nicht erreichbar.",
        "Daten sind veraltet und sollten vor Entscheidungen aktualisiert werden.",
        "Keine verwertbaren News für dieses Symbol gefunden."
      ])
    );
    expect(staleReport.sources[0].status).toBe("missing");

    const delayed = cloneDetail("MSFT");
    delayed.quote.quality = "delayed";
    delayed.quote.asOf = "2026-06-30T11:35:00+02:00";
    const delayedReport = assessDataQuality(delayed, new Date("2026-06-30T12:00:00+02:00"));
    expect(delayedReport.freshness).toBe("delayed");
    expect(delayedReport.sources[0].status).toBe("delayed");
    expect(delayedReport.warnings).toContain("Daten sind verzögert und nicht als Live-Kurs geeignet.");

    const contradictory = cloneDetail("AAPL");
    contradictory.quote.quality = "near_realtime";
    contradictory.quote.changePercent = 4.2;
    contradictory.news = [{ ...contradictory.news[0], sentiment: "negative", relevance: 90 }];
    const contradictoryReport = assessDataQuality(contradictory, new Date(contradictory.quote.asOf));
    expect(contradictoryReport.sourceLabel).toBe("Near-Realtime-Daten");
    expect(contradictoryReport.contradictions).toContain(
      "Kurs steigt stark, obwohl relevante News negativ bewertet werden."
    );
    expect(contradictoryReport.confidence).toBeLessThan(contradictoryReport.score);

    const crypto = cloneDetail("BTC-USD");
    crypto.quote.quality = "historical";
    crypto.news = [];
    const cryptoReport = assessDataQuality(crypto, new Date(crypto.quote.asOf));
    expect(cryptoReport.sourceLabel).toBe("Historische Daten");
    expect(cryptoReport.warnings).toContain(
      "Krypto-Fundamentaldaten sind strukturell nicht mit Aktien-Kennzahlen vergleichbar."
    );

    const realtime = cloneDetail("VOO");
    realtime.quote.quality = "realtime";
    realtime.quote.provider = "Unit Test Realtime Provider";
    const realtimeReport = assessDataQuality(realtime, new Date(realtime.quote.asOf));
    expect(realtimeReport.sourceLabel).toBe("Realtime-Daten");
    expect(realtimeReport.freshness).toBe("fresh");
    expect(realtimeReport.sufficientForAnalysis).toBe(true);
  });
});

function cloneDetail(symbol: string) {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as MockDetail;
}
