import { beforeEach, describe, expect, it, vi } from "vitest";

const listCorporateActionsByDateRange = vi.fn();
vi.mock("@/lib/corporate-action-store", () => ({
  listCorporateActionsByDateRange: (...args: unknown[]) => listCorporateActionsByDateRange(...args)
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  listCorporateActionsByDateRange.mockResolvedValue({
    available: true,
    events: [],
    retrievedAt: "2026-08-10T12:00:00.000Z",
    complete: false,
    source: "corporate_actions_ledger",
    note: "Keine Ereignisse."
  });
});

async function call(query: string) {
  const { GET } = await import("./route");
  return GET(new Request(`https://stockpilot.test/api/calendar/events?${query}`, {
    headers: { "x-real-ip": `10.31.5.${Math.floor(Math.random() * 200) + 1}` }
  }));
}

describe("GET /api/calendar/events", () => {
  it("begrenzt den Zeitraum auf 366 Tage", async () => {
    const response = await call("from=2025-01-01&to=2026-08-10");
    expect(response.status).toBe(400);
    expect(listCorporateActionsByDateRange).not.toHaveBeenCalled();
  });

  it("liefert ausschließlich belegte Ledger-Ereignisse mit unvollständiger Coverage", async () => {
    const response = await call("from=2026-08-01&to=2026-09-01");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(listCorporateActionsByDateRange).toHaveBeenCalledWith("2026-08-01", "2026-09-01");
    expect(body.complete).toBe(false);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
