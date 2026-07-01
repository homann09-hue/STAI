import { describe, expect, it } from "vitest";
import { billingGateStatus, getFeatureGateStatus, isFeatureTechnicallyActive, pricingTiers } from "@/lib/feature-gates";

describe("pricing feature gates", () => {
  it("does not mark paid features as active while billing is disabled", () => {
    expect(billingGateStatus.active).toBe(false);
    expect(getFeatureGateStatus("pro", "pro_terminal")).toBe("demo");
    expect(isFeatureTechnicallyActive("pro", "pro_terminal")).toBe(false);
  });

  it("keeps free essentials active and enterprise features gated", () => {
    expect(isFeatureTechnicallyActive("free", "watchlist_basic")).toBe(true);
    expect(getFeatureGateStatus("free", "api")).toBe("locked");
    expect(pricingTiers.map((tier) => tier.id)).toEqual(["free", "starter", "pro", "elite"]);
  });
});
