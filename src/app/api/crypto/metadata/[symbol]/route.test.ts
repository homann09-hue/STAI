import { beforeEach, describe, expect, it, vi } from "vitest";

const getCoinGeckoMetadata = vi.fn();
vi.mock("@/lib/providers/coingecko-client", () => ({ getCoinGeckoMetadata: (...args: unknown[]) => getCoinGeckoMetadata(...args) }));
vi.mock("@/lib/api-guard", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/api-guard")>(), rateLimit: vi.fn().mockResolvedValue(null) }));
import { GET } from "./route";

function request(symbol: string) {
  return GET(new Request(`http://localhost/api/crypto/metadata/${encodeURIComponent(symbol)}`), { params: Promise.resolve({ symbol }) });
}

beforeEach(() => getCoinGeckoMetadata.mockReset());

describe("GET /api/crypto/metadata/[symbol]", () => {
  it("blockiert XSS vor dem Providerabruf", async () => {
    const response = await request("<script>");
    expect(response.status).toBe(400);
    expect(getCoinGeckoMetadata).not.toHaveBeenCalled();
  });
  it("liefert Referenzqualität ohne Realtime-Claim", async () => {
    getCoinGeckoMetadata.mockResolvedValue({ value: { status: "resolved", data: { coinId: "bitcoin" } }, quality: "delayed", fromCache: false, cacheStoredAt: null, warning: null });
    const response = await request("btc-usd");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(getCoinGeckoMetadata).toHaveBeenCalledWith("BTC-USD");
    expect(response.headers.get("X-StockPilot-Data-Quality")).toBe("delayed");
    expect(body.metadata.disclaimer).toContain("kein sekündlicher Live-Kurs");
  });
  it("antwortet bei Mehrdeutigkeit mit 409", async () => {
    getCoinGeckoMetadata.mockResolvedValue({ value: { status: "ambiguous", pair: { baseSymbol: "PAY" }, candidates: [{ id: "pay-a" }, { id: "pay-b" }] }, quality: "cached", fromCache: true, cacheStoredAt: "2026-08-17T10:00:00.000Z", warning: null });
    const response = await request("PAY-USD");
    expect(response.status).toBe(409);
    expect((await response.json()).metadata.warning).toContain("mehrdeutig");
  });
});
