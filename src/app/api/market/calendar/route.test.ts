import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchExchangeCalendar = vi.fn();
vi.mock("@/lib/providers/exchange-calendar-provider", () => ({
  fetchExchangeCalendar: (...args: unknown[]) => fetchExchangeCalendar(...args)
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  fetchExchangeCalendar.mockResolvedValue({
    exchange: "NASDAQ",
    available: false,
    session: { status: "unknown" },
    coverage: { hours: "unavailable", holidays: "unavailable" }
  });
});

async function call(exchange: string) {
  const { GET } = await import("./route");
  return GET(new Request(`https://stockpilot.test/api/market/calendar?exchange=${encodeURIComponent(exchange)}`, {
    headers: { "x-real-ip": `10.31.4.${Math.floor(Math.random() * 200) + 1}` }
  }));
}

describe("GET /api/market/calendar", () => {
  it("validiert den Börsencode vor dem Providerabruf", async () => {
    const response = await call("<script>");
    expect(response.status).toBe(400);
    expect(fetchExchangeCalendar).not.toHaveBeenCalled();
  });

  it("liefert unbekannte Providerdaten ohne öffentlichen Cache", async () => {
    const response = await call("nasdaq");
    expect(response.status).toBe(200);
    expect(fetchExchangeCalendar).toHaveBeenCalledWith("NASDAQ");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
