import { describe, expect, it } from "vitest";

import {
  normalizeTwelveDataBars,
  normalizeTwelveDataBatchQuotes,
  normalizeTwelveDataMarketState,
  normalizeTwelveDataQuote,
  normalizeTwelveDataSearch,
  resolveTwelveDataInstrument,
} from "@/lib/providers/twelve-data-normalization";

const now = new Date("2026-08-12T18:00:00.000Z");

describe("Twelve Data normalization", () => {
  it("normalizes a quote without inventing bid, ask, currency or delay", () => {
    const quote = normalizeTwelveDataQuote(
      {
        symbol: "AAPL",
        name: "Apple Inc",
        mic_code: "XNAS",
        type: "Common Stock",
        timestamp: 1786553940,
        close: "229.65",
        open: "226.10",
        high: "231.00",
        low: "225.80",
        previous_close: "227.50",
        change: "2.15",
        percent_change: "0.945",
        volume: "39123456",
        is_market_open: true,
      },
      "AAPL",
      { quality: "near_realtime", latencyMs: 42, now },
    );

    expect(quote).toMatchObject({
      symbol: "AAPL",
      providerId: "twelve_data",
      providerSymbol: "AAPL",
      instrumentId: null,
      venue: "XNAS",
      currency: "XXX",
      price: 229.65,
      bid: null,
      ask: null,
      marketStatus: "open",
      quality: "near_realtime",
      reportedDelaySeconds: null,
    });
    expect(quote?.qualityIssues).toContain("currency_unknown");
    expect(quote?.qualityIssues).toContain("twelve_data_delay_unverified");
  });

  it("does not turn an unzoned quote datetime into a current timestamp", () => {
    const quote = normalizeTwelveDataQuote(
      { symbol: "SAP", close: "190", datetime: "2026-08-12 17:30:00" },
      "SAP",
      { quality: "near_realtime", latencyMs: 5, now },
    );
    expect(quote?.eventTimestamp).toBeNull();
    expect(quote?.qualityIssues).toContain("event_timestamp_missing");
  });

  it("normalizes an official comma-batch response by requested symbol", () => {
    const quotes = normalizeTwelveDataBatchQuotes(
      {
        AAPL: { symbol: "AAPL", close: "220", currency: "USD" },
        "BTC/USD": {
          symbol: "BTC/USD",
          close: "118000",
          currency: "USD",
          type: "Digital Currency",
        },
      },
      ["AAPL", "BTC-USD"],
      { quality: "near_realtime", latencyMs: 9, now },
    );
    expect(quotes.map((quote) => quote.symbol)).toEqual(["AAPL", "BTC-USD"]);
    expect(quotes[1]).toMatchObject({
      providerSymbol: "BTC/USD",
      assetType: "crypto",
    });
  });

  it("preserves listings and resolves only with sufficient venue evidence", () => {
    const rows = normalizeTwelveDataSearch({
      status: "ok",
      data: [
        {
          symbol: "SAP",
          instrument_name: "SAP SE",
          exchange: "XETRA",
          mic_code: "XETR",
          exchange_timezone: "Europe/Berlin",
          instrument_type: "Common Stock",
          country: "Germany",
          currency: "EUR",
        },
        {
          symbol: "SAP",
          instrument_name: "SAP SE ADR",
          exchange: "NYSE",
          mic_code: "XNYS",
          exchange_timezone: "America/New_York",
          instrument_type: "American Depositary Receipt",
          country: "United States",
          currency: "USD",
        },
      ],
    });

    expect(resolveTwelveDataInstrument(rows, { symbol: "SAP" }).status).toBe(
      "ambiguous",
    );
    expect(
      resolveTwelveDataInstrument(rows, { symbol: "SAP", mic: "XETR" }),
    ).toMatchObject({
      status: "resolved",
      instrument: {
        currency: "EUR",
        country: "DE",
        tradingTimezone: "Europe/Berlin",
      },
    });
  });

  it("validates, sorts and labels raw historical bars", () => {
    const result = normalizeTwelveDataBars(
      {
        status: "ok",
        meta: {
          symbol: "AAPL",
          interval: "5min",
          currency: "USD",
          exchange: "NASDAQ",
          mic_code: "XNAS",
          exchange_timezone: "America/New_York",
          type: "Common Stock",
        },
        values: [
          {
            datetime: "2026-08-12 15:35:00",
            open: "101",
            high: "103",
            low: "100",
            close: "102",
            volume: "1200",
          },
          {
            datetime: "2026-08-12 15:30:00",
            open: "100",
            high: "102",
            low: "99",
            close: "101",
            volume: "1000",
          },
          {
            datetime: "2026-08-12 15:40:00",
            open: "102",
            high: "104",
            low: "101",
            close: "103",
          },
        ],
      },
      "AAPL",
      { now },
    );

    expect(result.bars).toHaveLength(2);
    expect(result.bars.map((bar) => bar.close)).toEqual([101, 102]);
    expect(result.bars[0]).toMatchObject({
      interval: "5m",
      providerId: "twelve_data",
      venue: "XNAS",
      isAdjusted: false,
      adjustmentType: "RAW",
      quality: "historical",
    });
    expect(result.quality.rejected).toBe(1);
  });

  it("normalizes market state without deriving trading hours", () => {
    expect(
      normalizeTwelveDataMarketState([
        {
          name: "NYSE",
          code: "XNYS",
          country: "United States",
          is_market_open: false,
          time_to_open: "13:00:00",
          time_to_close: "00:00:00",
        },
      ]),
    ).toEqual([
      expect.objectContaining({ code: "XNYS", is_market_open: false }),
    ]);
  });
});
