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
    expect(isFeatureTechnicallyActive("free", "watchlist_basic")).toBe(true);
    expect(isFeatureTechnicallyActive("free", "portfolio")).toBe(true);
    expect(getFeatureGateStatus("elite", "team")).toBe("demo");
    expect(pricingTiers.map((tier) => tier.id)).toEqual(["free", "starter", "pro", "elite"]);
  });

  it("defines increasing backend limits without unlimited sentinels", () => {
    expect(getPlanLimits("free").watchlistItems).toBe(10);
    expect(getPlanLimits("starter").watchlistItems).toBeGreaterThan(getPlanLimits("free").watchlistItems);
    expect(getPlanLimits("pro").portfolios).toBeGreaterThan(getPlanLimits("starter").portfolios);
    expect(Object.values(getPlanLimits("elite")).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
  });
});
