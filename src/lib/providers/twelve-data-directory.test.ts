import { afterEach, describe, expect, it, vi } from "vitest";

const searchInstruments = vi.fn();

vi.mock("@/lib/providers/twelve-data-client", () => ({
  getTwelveDataApiKey: () => process.env.TWELVE_DATA_API_KEY?.trim() || null,
  getTwelveDataClient: () => ({ searchInstruments }),
}));

import { searchProviderInstruments } from "@/lib/providers/instrument-directory-provider";

afterEach(() => {
  vi.unstubAllEnvs();
  searchInstruments.mockReset();
});

describe("Twelve Data instrument discovery", () => {
  it("keeps exchange identity and clearly reports search-driven coverage", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TWELVE_DATA_API_KEY", "server-secret");
    delete process.env.FMP_API_KEY;
    searchInstruments.mockResolvedValue({
      latencyMs: 12,
      quota: { used: 1, left: 7 },
      data: [
        {
          symbol: "SAP",
          name: "SAP SE",
          assetClass: "stock",
          instrumentType: "Common Stock",
          exchange: "XETRA",
          mic: "XETR",
          currency: "EUR",
          country: "DE",
          tradingTimezone: "Europe/Berlin",
          providerSymbol: "SAP",
        },
      ],
    });

    const result = await searchProviderInstruments("SAP");
    expect(result.providers).toEqual(["Twelve Data"]);
    expect(result.capability).toBe("search_only");
    expect(result.capabilityNote).toMatch(/nicht.*vollstaendig/i);
    expect(result.hits[0]).toMatchObject({
      symbol: "SAP",
      exchange: "XETRA",
      mic: "XETR",
      country: "DE",
      tradingTimezone: "Europe/Berlin",
      provider: "Twelve Data",
    });
  });
});
