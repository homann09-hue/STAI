import { describe, expect, it } from "vitest";
import { assessDataQuality, validateAssetData } from "@/lib/data-quality";
import { getMockAsset } from "@/lib/mock/market";

describe("data quality", () => {
  it("marks complete mock assets clearly and blocks decision-grade signals", () => {
    const asset = getMockAsset("MSFT");
    const quality = assessDataQuality(asset!);

    expect(validateAssetData(asset!).valid).toBe(true);
    expect(quality.sufficientForAnalysis).toBe(false);
    expect(quality.isMock).toBe(true);
    expect(quality.sources.some((source) => source.type === "mock")).toBe(true);
    expect(quality.warnings).toContain("Mock-Daten sind Demo-/Produktdaten und dürfen nicht als reale Marktdaten genutzt werden.");
  });

  it("attributes verified provider news without inventing a mock source", () => {
    const asset = structuredClone(getMockAsset("MSFT")!);
    asset.quote.quality = "near_realtime";
    asset.quote.provider = "Finnhub";
    asset.news = asset.news.map((item, index) => ({
      ...item,
      source: index % 2 ? "NewsAPI" : "Marketaux",
      url: `https://example.com/news/${index}`
    }));

    const quality = assessDataQuality(asset, new Date(asset.quote.asOf));

    expect(quality.sources.some((source) => source.type === "provider" && source.name.includes("Marketaux"))).toBe(true);
    expect(quality.sources.some((source) => source.type === "mock")).toBe(false);
    expect(quality.sufficientForAnalysis).toBe(true);
  });

  it("quarantines mixed fixture news from decision-grade analysis", () => {
    const asset = structuredClone(getMockAsset("MSFT")!);
    asset.quote.quality = "near_realtime";
    asset.quote.provider = "Finnhub";
    const originalNews = asset.news[0];
    asset.news = [
      {
        ...originalNews,
        source: "Marketaux",
        url: "https://example.com/news/verified"
      },
      {
        ...originalNews,
        id: `${originalNews.id}-fixture`,
        source: "StockPilot Mock News Feed",
        url: "#"
      }
    ];

    const quality = assessDataQuality(asset, new Date(asset.quote.asOf));

    expect(quality.sources.some((source) => source.type === "provider")).toBe(true);
    expect(quality.sources.some((source) => source.type === "mock")).toBe(true);
    expect(quality.sufficientForAnalysis).toBe(false);
    expect(quality.warnings).toContain(
      "Mindestens eine Nachricht stammt aus Entwicklungs-Fixtures und bleibt von Analysen ausgeschlossen."
    );
  });
});
