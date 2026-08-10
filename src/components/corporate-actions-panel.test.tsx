// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CorporateActionsPanel } from "./corporate-actions-panel";
import type { CorporateActionsResult } from "@/lib/corporate-actions";

afterEach(cleanup);

function result(overrides: Partial<CorporateActionsResult> = {}): CorporateActionsResult {
  return {
    symbol: "AAPL",
    actions: [],
    available: false,
    partial: false,
    provider: null,
    quality: "unavailable",
    retrievedAt: "2026-08-10T12:00:00.000Z",
    coverage: { dividends: "unavailable", splits: "unavailable" },
    note: "Provider nicht verfügbar.",
    ...overrides
  };
}

describe("CorporateActionsPanel", () => {
  it("zeigt fehlende Daten als nicht verfügbar und erfindet keine Ereignisse", () => {
    const { container } = render(<CorporateActionsPanel result={result()} />);
    const text = container.textContent ?? "";

    expect(screen.getByText("NICHT VERFÜGBAR")).toBeTruthy();
    expect(text).toMatch(/keine Ereignisse geschätzt/i);
    expect(text).not.toMatch(/Bardividende|Aktiensplit/);
  });

  it("kennzeichnet Teilabdeckung und jeden Provider-Datensatz", () => {
    const action = {
      canonicalActionId: "fmp:cash_dividend:AAPL:2026-08-07:0.26:USD",
      symbol: "AAPL",
      type: "cash_dividend" as const,
      effectiveDate: "2026-08-07",
      announcementDate: "2026-07-31",
      recordDate: "2026-08-10",
      paymentDate: "2026-08-13",
      oldSymbol: null,
      newSymbol: null,
      cashAmount: 0.26,
      adjustedCashAmount: 0.26,
      currency: "USD",
      ratioFrom: null,
      ratioTo: null,
      lifecycle: "effective" as const,
      provider: "Financial Modeling Prep",
      sourceUrl: "https://site.financialmodelingprep.com/developer/docs/historical-stock-dividends-api/",
      quality: "provider_reported" as const,
      asOf: "2026-07-31T00:00:00.000Z",
      receivedAt: "2026-08-10T12:00:00.000Z"
    };
    const { container } = render(<CorporateActionsPanel result={result({
      actions: [action],
      available: true,
      partial: true,
      provider: "Financial Modeling Prep",
      quality: "provider_reported",
      coverage: { dividends: "available", splits: "unavailable" },
      note: "Teilweise verfügbar."
    })} />);

    expect(screen.getByText("TEILABDECKUNG")).toBeTruthy();
    expect(container.textContent ?? "").toMatch(/0,26 USD/);
    expect(screen.getByRole("link", { name: /Methodik \/ Quelle/i }).getAttribute("href")).toMatch(/^https:\/\//);
  });
});
