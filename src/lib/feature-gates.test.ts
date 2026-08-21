import { describe, expect, it } from "vitest";
import {
  billingGateStatus,
  getFeatureGateStatus,
  getPlanLimits,
  isFeatureTechnicallyActive,
  planLimitContract,
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

  it("defines the exact commercial limit contract once for all three plans", () => {
    expect(planLimitContract).toEqual({
      free: {
        maxWatchlistItems: 15,
        maxAlerts: 3,
        historicalDataYears: 1,
        portfolios: 1,
        aiAnalysesPerDay: 3,
        apiRequestsPerDay: 0
      },
      pro: {
        maxWatchlistItems: 250,
        maxAlerts: 100,
        historicalDataYears: 10,
        portfolios: 10,
        aiAnalysesPerDay: 100,
        apiRequestsPerDay: 1_000
      },
      premium: {
        maxWatchlistItems: 1_000,
        maxAlerts: 500,
        historicalDataYears: 20,
        portfolios: 25,
        aiAnalysesPerDay: 500,
        apiRequestsPerDay: 10_000
      }
    });
    for (const tier of pricingTiers) expect(tier.limits).toBe(planLimitContract[tier.id]);
  });
});
