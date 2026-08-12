import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChainedQuoteProvider,
  resetMarketProviderRuntimeStateForTests,
} from "@/lib/providers/market-provider";
import type { MarketDataQuality, NormalizedQuote } from "@/lib/types";
import { buildNormalizedQuote } from "@/lib/canonical-quote";

/**
 * Der Test, der vor dem zweiten Schlüssel nicht möglich war.
 *
 * Bis Finnhub konfiguriert war, gab es nichts, worauf ausgewichen werden
 * konnte — eine Kette mit einem Glied ist keine. Jetzt lässt sich prüfen, was
 * bei einem Ausfall tatsächlich passiert, statt es zu behaupten.
 *
 * Die wichtigste Zusicherung ist die letzte: der Kurs trägt den Namen und die
 * Qualität **der Quelle, die geantwortet hat**. Würde die Kette ihre eigene
 * Kennung aufstempeln, erschiene ein near-realtime-Kurs von Finnhub als
 * verzögerter FMP-Kurs — eine Falschauskunft an genau der Stelle, an der
 * StockPilot Ehrlichkeit verspricht.
 */

type FakeProvider = {
  providerName: string;
  providerId: "fmp" | "finnhub";
  quality: MarketDataQuality;
  streamMode: "rest_polling";
  getQuote: (symbol: string) => Promise<NormalizedQuote | null>;
  getQuotes: (symbols: string[]) => Promise<NormalizedQuote[]>;
};

function quoteFrom(
  symbol: string,
  provider: string,
  quality: MarketDataQuality,
  price: number,
): NormalizedQuote {
  return buildNormalizedQuote({
    instrumentId: `stock:test:${symbol.toLowerCase()}:usd`,
    symbol,
    providerId: provider.toLowerCase().replace(/\s+/g, "_"),
    providerSymbol: symbol,
    venue: "TEST",
    last: price,
    currency: "USD",
    previousClose: price,
    change: 0,
    changePercent: 0,
    high: price,
    low: price,
    open: price,
    eventTimestamp: "2026-08-08T12:00:00.000Z",
    providerTimestamp: "2026-08-08T12:00:00.000Z",
    receivedTimestamp: "2026-08-08T12:00:00.010Z",
    provider,
    quality,
    latencyMs: 10,
    marketStatus: "unknown",
  });
}

function fake(
  name: string,
  id: "fmp" | "finnhub",
  quality: MarketDataQuality,
  behaviour: "answers" | "throws" | "empty",
  price = 100,
): FakeProvider {
  return {
    providerName: name,
    providerId: id,
    quality,
    streamMode: "rest_polling",
    getQuote: vi.fn(async (symbol: string) => {
      if (behaviour === "throws") throw new Error(`${name} nicht erreichbar`);
      if (behaviour === "empty") return null;
      return quoteFrom(symbol, name, quality, price);
    }),
    getQuotes: async () => [],
  };
}

// Die Kette erwartet die interne QuoteProvider-Schnittstelle. Die Attrappen
// erfuellen sie strukturell; der Cast haelt den Test frei von Netzwerkcode.
const chainOf = (...providers: FakeProvider[]) =>
  new ChainedQuoteProvider(
    providers as unknown as ConstructorParameters<
      typeof ChainedQuoteProvider
    >[0],
  );

afterEach(async () => {
  await resetMarketProviderRuntimeStateForTests();
});

describe("Ausfall der ersten Kursquelle", () => {
  it("weicht auf die zweite aus, wenn die erste einen Fehler wirft", async () => {
    const primary = fake("FMP", "fmp", "delayed", "throws");
    const secondary = fake(
      "Finnhub",
      "finnhub",
      "near_realtime",
      "answers",
      313.33,
    );

    const quote = await chainOf(primary, secondary).getQuote("AAPL");

    expect(quote?.price).toBe(313.33);
    expect(primary.getQuote).toHaveBeenCalledTimes(1);
    expect(secondary.getQuote).toHaveBeenCalledTimes(1);
  });

  it("weicht auch aus, wenn die erste nur nichts liefert", async () => {
    // Ein leeres Ergebnis ist genauso ein Ausfall wie ein Fehler -- der Nutzer
    // merkt keinen Unterschied.
    const primary = fake("FMP", "fmp", "delayed", "empty");
    const secondary = fake(
      "Finnhub",
      "finnhub",
      "near_realtime",
      "answers",
      313.33,
    );

    expect((await chainOf(primary, secondary).getQuote("MSFT"))?.price).toBe(
      313.33,
    );
  });

  it("fragt die zweite gar nicht erst, wenn die erste antwortet", async () => {
    // Sonst wuerde jede Anfrage doppelt Kosten verursachen.
    const primary = fake("FMP", "fmp", "delayed", "answers", 312.0);
    const secondary = fake(
      "Finnhub",
      "finnhub",
      "near_realtime",
      "answers",
      313.33,
    );

    const quote = await chainOf(primary, secondary).getQuote("NVDA");

    expect(quote?.price).toBe(312.0);
    expect(secondary.getQuote).not.toHaveBeenCalled();
  });

  it("gibt nichts zurück, wenn keine Quelle antwortet", async () => {
    // Null heisst ehrlich "nichts bekommen". Der Aufrufer entscheidet ueber den
    // Mock-Rueckfall -- die Kette erfindet keinen Kurs.
    const chain = chainOf(
      fake("FMP", "fmp", "delayed", "throws"),
      fake("Finnhub", "finnhub", "near_realtime", "throws"),
    );

    expect(await chain.getQuote("TSLA")).toBeNull();
  });

  it("trägt Name und Qualität der antwortenden Quelle, nicht der bevorzugten", async () => {
    // Der Kern: ein near-realtime-Kurs von Finnhub darf nicht als verzoegerter
    // FMP-Kurs erscheinen.
    const quote = await chainOf(
      fake("FMP", "fmp", "delayed", "throws"),
      fake("Finnhub", "finnhub", "near_realtime", "answers", 313.33),
    ).getQuote("AMZN");

    expect(quote?.provider).toBe("Finnhub");
    expect(quote?.quality).toBe("near_realtime");
    expect(quote?.provider).not.toBe("FMP");
    expect(quote?.quality).not.toBe("delayed");
  });

  it("stuft auch nach unten ehrlich ein", async () => {
    // Umgekehrt genauso wichtig: faellt die near-realtime-Quelle aus, darf der
    // verzoegerte Ersatz nicht als near-realtime durchgehen.
    const quote = await chainOf(
      fake("Finnhub", "finnhub", "near_realtime", "throws"),
      fake("FMP", "fmp", "delayed", "answers", 312.0),
    ).getQuote("GOOGL");

    expect(quote?.provider).toBe("FMP");
    expect(quote?.quality).toBe("delayed");
  });

  it("stops a delayed FMP batch after the first 429 and resolves through the fallback", async () => {
    const fmp = fake("FMP", "fmp", "delayed", "answers");
    const finnhub = fake(
      "Finnhub",
      "finnhub",
      "near_realtime",
      "answers",
      401.25,
    );
    vi.mocked(fmp.getQuote).mockRejectedValue(new Error("FMP HTTP 429"));

    const symbols = ["ORCL", "IBM", "CSCO"];
    const quotes = await chainOf(fmp, finnhub).getQuotes(symbols);

    expect(fmp.getQuote).toHaveBeenCalledTimes(1);
    expect(finnhub.getQuote).toHaveBeenCalledTimes(symbols.length);
    expect(quotes.map((quote) => quote.symbol)).toEqual(symbols);
    expect(quotes.every((quote) => quote.provider === "Finnhub")).toBe(true);
  });

  it("serializes FMP quote work even when a fresh batch contains many symbols", async () => {
    const fmp = fake("FMP", "fmp", "delayed", "answers", 200);
    let active = 0;
    let maxActive = 0;

    vi.mocked(fmp.getQuote).mockImplementation(async (symbol: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return quoteFrom(symbol, "FMP", "delayed", 200);
    });

    const symbols = ["JPM", "XOM", "LLY"];
    const quotes = await chainOf(fmp).getQuotes(symbols);

    expect(quotes).toHaveLength(symbols.length);
    expect(maxActive).toBe(1);
  });
});
