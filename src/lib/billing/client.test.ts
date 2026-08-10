import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBillingEntitlements } from "./client";

const entitlementPayload = {
  billingActive: false,
  plan: "free",
  status: "inactive",
  provider: "stripe",
  validUntil: null,
  cancelAtPeriodEnd: false,
  degraded: false,
  error: null,
  mode: "supabase",
  limits: {},
  tiers: [],
  billing: {
    provider: "stripe",
    configured: true,
    webhookConfigured: true,
    portalConfigured: true,
    plans: {
      pro: { month: true, year: true },
      premium: { month: true, year: true }
    }
  }
};

describe("billing client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent entitlement reads without caching stale results", async () => {
    const fetchMock = vi.fn(async () => Response.json(entitlementPayload));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      fetchBillingEntitlements("access-token"),
      fetchBillingEntitlements("access-token")
    ]);

    expect(first).toEqual(entitlementPayload);
    expect(second).toEqual(entitlementPayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchBillingEntitlements("access-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a safe API error instead of accepting a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Billing vorübergehend nicht verfügbar." }, { status: 503 }))
    );

    await expect(fetchBillingEntitlements("access-token")).rejects.toThrow(
      "Billing vorübergehend nicht verfügbar."
    );
  });
});
