import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: vi.fn(async () => ({ ok: false, reason: "missing_session" })),
  listUserAlerts: vi.fn(),
  createUserAlert: vi.fn(),
  updateUserAlert: vi.fn(),
  deleteUserAlert: vi.fn(),
  getUserPortfolio: vi.fn(),
  applyUserPortfolioTrade: vi.fn(),
  deleteUserPortfolioPosition: vi.fn(),
  PortfolioTradeConflictError: class PortfolioTradeConflictError extends Error {}
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Unauthentifizierte Nutzerzustände", () => {
  it("liefert eine leere Alert-Liste ohne Mock-Ausführung", async () => {
    const { GET } = await import("@/app/api/alerts/route");
    const response = await GET(new Request("http://localhost/api/alerts"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alerts).toEqual([]);
    expect(body.mode).toBe("local");
    expect(body.metadata).toMatchObject({ dataQuality: "user_data", demo: false, execution: "unavailable" });
  });

  it("liefert ein leeres Portfolio ohne Beispielperformance", async () => {
    const { GET } = await import("@/app/api/portfolio/route");
    const response = await GET(new Request("http://localhost/api/portfolio"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.positions).toEqual([]);
    expect(body.totalValue).toBe(0);
    expect(body.totalPnL).toBe(0);
    expect(body.mode).toBe("local");
    expect(body.metadata).toMatchObject({ dataQuality: "user_data", demo: false });
  });
});
