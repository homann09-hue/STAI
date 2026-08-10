// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketCalendarView } from "./market-calendar-view";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/calendar/events")) {
      return Promise.resolve(new Response(JSON.stringify({
        available: true,
        complete: false,
        source: "corporate_actions_ledger",
        retrievedAt: "2026-08-10T12:00:00.000Z",
        note: "1 belegtes Ledger-Ereignis. Das Universum ist nicht vollständig.",
        events: [{
          canonicalActionId: "fmp:cash_dividend:AAPL:2026-08-20:0.25:USD",
          symbol: "AAPL",
          type: "cash_dividend",
          effectiveDate: "2026-08-20",
          announcementDate: null,
          recordDate: null,
          paymentDate: null,
          oldSymbol: null,
          newSymbol: null,
          cashAmount: 0.25,
          adjustedCashAmount: 0.25,
          currency: "USD",
          ratioFrom: null,
          ratioTo: null,
          lifecycle: "scheduled",
          provider: "Financial Modeling Prep",
          sourceUrl: "https://site.financialmodelingprep.com/developer/docs/historical-stock-dividends-api/",
          quality: "provider_reported",
          asOf: "2026-08-10T00:00:00.000Z",
          receivedAt: "2026-08-10T12:00:00.000Z"
        }]
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      exchange: "NASDAQ",
      name: null,
      timezone: null,
      regularSchedule: [],
      holidays: [],
      available: false,
      partial: false,
      provider: null,
      quality: "unavailable",
      retrievedAt: "2026-08-10T12:00:00.000Z",
      latencyMs: null,
      coverage: { hours: "unavailable", holidays: "unavailable" },
      session: { status: "unknown", reason: "Kein belastbarer Börsenkalender verfügbar.", localTime: null, evaluatedAt: "2026-08-10T12:00:00.000Z" },
      note: "Provider-Rate-Limit erreicht."
    }), { status: 200 }));
  }));
});

describe("MarketCalendarView", () => {
  it("zeigt belegte Ledger-Termine und erfindet keine Demo-Ereignisse", async () => {
    const { container } = render(<MarketCalendarView />);
    await waitFor(() => expect(screen.getByText("Bardividende")).toBeTruthy());
    const text = container.textContent ?? "";
    expect(text).toContain("PROVIDER GEMELDET");
    expect(text).toContain("STATUS UNBEKANNT");
    expect(text).not.toContain("NVIDIA Earnings Watch");
    expect(text).not.toContain("Fed Zinsentscheid");
  });
});
