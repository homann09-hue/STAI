import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CorporateActionsResult } from "@/lib/corporate-actions";

const fetchCorporateActions = vi.fn();
const persistCorporateActions = vi.fn();
const resolveInstrumentIdentityBySymbol = vi.fn();

vi.mock("@/lib/providers/corporate-actions-provider", () => ({
  fetchCorporateActions: (...args: unknown[]) => fetchCorporateActions(...args)
}));
vi.mock("@/lib/corporate-action-store", () => ({
  persistCorporateActions: (...args: unknown[]) => persistCorporateActions(...args)
}));
vi.mock("@/lib/instrument-master-store", () => ({
  resolveInstrumentIdentityBySymbol: (...args: unknown[]) => resolveInstrumentIdentityBySymbol(...args)
}));

function providerResult(overrides: Partial<CorporateActionsResult> = {}): CorporateActionsResult {
  return {
    symbol: "AAPL",
    actions: [],
    available: true,
    partial: false,
    provider: "Financial Modeling Prep",
    quality: "provider_reported",
    retrievedAt: "2026-08-10T12:00:00.000Z",
    coverage: { dividends: "available", splits: "available" },
    note: "Keine Ereignisse gemeldet.",
    ...overrides
  };
}

async function call(symbol: string) {
  const { GET } = await import("./route");
  return GET(
    new Request(`https://stockpilot.test/api/corporate-actions/${encodeURIComponent(symbol)}`, {
      headers: { "x-real-ip": `10.20.30.${Math.floor(Math.random() * 200) + 1}` }
    }),
    { params: Promise.resolve({ symbol }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  fetchCorporateActions.mockResolvedValue(providerResult());
  persistCorporateActions.mockResolvedValue({ status: "skipped", stored: 0 });
  resolveInstrumentIdentityBySymbol.mockResolvedValue({
    status: "resolved",
    identity: { assetClass: "stock" },
  });
});

describe("GET /api/corporate-actions/[symbol]", () => {
  it("validiert das Symbol vor jedem Providerabruf", async () => {
    const response = await call("<script>");
    expect(response.status).toBe(400);
    expect(fetchCorporateActions).not.toHaveBeenCalled();
  });

  it("liefert Herkunft und Abdeckung und aktualisiert den Ledger", async () => {
    const response = await call("aapl");
    const body = await response.json() as CorporateActionsResult;

    expect(response.status).toBe(200);
    expect(fetchCorporateActions).toHaveBeenCalledWith("AAPL", expect.any(Date), "stock");
    expect(persistCorporateActions).toHaveBeenCalledWith(body.actions);
    expect(body.quality).toBe("provider_reported");
    expect(body.coverage).toEqual({ dividends: "available", splits: "available" });
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
  });

  it("gibt die bekannte Assetklasse an den Provider-Gate weiter", async () => {
    resolveInstrumentIdentityBySymbol.mockResolvedValue({
      status: "resolved",
      identity: { assetClass: "crypto" },
    });
    await call("BTC-USD");

    expect(fetchCorporateActions).toHaveBeenCalledWith("BTC-USD", expect.any(Date), "crypto");
  });

  it("ruft bei Mehrfachlistings keinen Provider auf", async () => {
    resolveInstrumentIdentityBySymbol.mockResolvedValue({
      status: "ambiguous",
      symbol: "ABC",
      candidates: [{ canonicalId: "stock:xnas:abc:usd" }, { canonicalId: "stock:xetr:abc:eur" }],
      truncated: false,
    });

    const response = await call("ABC");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.reason).toBe("listing_ambiguous");
    expect(fetchCorporateActions).not.toHaveBeenCalled();
  });

  it("cached eine fehlgeschlagene Providerauskunft nicht öffentlich", async () => {
    fetchCorporateActions.mockResolvedValue(providerResult({
      available: false,
      provider: null,
      quality: "unavailable",
      coverage: { dividends: "unavailable", splits: "unavailable" }
    }));
    const response = await call("AAPL");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
