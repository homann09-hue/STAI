import { beforeEach, describe, expect, it, vi } from "vitest";
import { planLimitContract } from "@/lib/feature-gates";

vi.mock("@/lib/admin-access", () => ({ hasPrivilegedAccess: () => true }));

function request() {
  return new Request("https://stockpilot.test/api/admin/plans", {
    headers: { "x-real-ip": `10.31.0.${Math.floor(Math.random() * 200) + 1}` }
  });
}

beforeEach(() => {
  vi.resetModules();
});

describe("GET /api/admin/plans", () => {
  it("returns only the canonical plans and their exact limits", async () => {
    const { GET } = await import("./route");
    const response = await GET(request());
    const body = (await response.json()) as { plans: Array<{ id: string; limits: unknown }> };

    expect(response.status).toBe(200);
    expect(body.plans.map((plan) => plan.id)).toEqual(["free", "pro", "premium"]);
    expect(body.plans.map((plan) => plan.limits)).toEqual([
      planLimitContract.free,
      planLimitContract.pro,
      planLimitContract.premium
    ]);
    expect(JSON.stringify(body)).not.toMatch(/starter|elite|business/i);
  });
});
