import { describe, expect, it } from "vitest";
import {
  billingGateStatus,
  getFeatureGateStatus,
  getPlanLimits,
  isFeatureTechnicallyActive,
  pricingTiers
} from "@/lib/feature-gates";

describe("pricing feature gates", () => {
  it("keeps paid features fail-closed without a verified entitlement", () => {
    expect(billingGateStatus.active).toBe(false);
    expect(getFeatureGateStatus("pro", "pro_terminal")).toBe("included");
    expect(isFeatureTechnicallyActive("pro", "pro_terminal")).toBe(false);
    expect(isFeatureTechnicallyActive("pro", "pro_terminal", true)).toBe(true);
  });

  it("keeps free essentials active and unfinished enterprise features unavailable", () => {
    expect(isFeatureTechnicallyActive("free", "asset_analysis")).toBe(true);
    expect(isFeatureTechnicallyActive("free", "portfolio")).toBe(true);
    expect(getFeatureGateStatus("premium", "exports")).toBe("demo");
    expect(pricingTiers.map((tier) => tier.id)).toEqual(["free", "pro", "premium"]);
  });

  it("defines increasing backend limits without unlimited sentinels", () => {
    expect(getPlanLimits("free").maxWatchlistItems).toBe(15);
    expect(getPlanLimits("pro").maxWatchlistItems).toBeGreaterThan(getPlanLimits("free").maxWatchlistItems);
    expect(getPlanLimits("pro").portfolios).toBeGreaterThan(getPlanLimits("free").portfolios);
    expect(getPlanLimits("premium").maxWatchlistItems).toBeGreaterThan(getPlanLimits("pro").maxWatchlistItems);
    // §4 verlangt eine Grenze fuer die Historie. Sie muss mit dem Tarif wachsen.
    expect(getPlanLimits("premium").historicalDataYears).toBeGreaterThan(getPlanLimits("free").historicalDataYears);
    expect(Object.values(getPlanLimits("premium")).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
  });
});
