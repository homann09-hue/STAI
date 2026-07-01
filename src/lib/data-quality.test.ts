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
});
