import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";

describe("risk engine", () => {
  it("produces explicit findings for risky assets", () => {
    const asset = getMockAsset("ETH-USD");

    expect(asset?.riskReport.findings.length).toBeGreaterThan(0);
    expect(asset?.riskReport.summary).toContain("Warnhinweis");
  });
});
