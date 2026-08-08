import { describe, expect, it, vi } from "vitest";
import { ChainedQuoteProvider } from "@/lib/providers/market-provider";
import type { MarketDataQuality, NormalizedQuote } from "@/lib/types";

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

function quoteFrom(provider: string, quality: MarketDataQuality, price: number): NormalizedQuote {
  return {
    symbol: "AAPL",
    price,
    previousClose: price,
    change: 0,
    changePercent: 0,
    high: price,
    low: price,
    open: price,
    timestamp: "2026-08-08T12:00:00.000Z",
    provider,
    quality,
    latencyMs: 10,
    marketStatus: "unknown"
  } as NormalizedQuote;
}

function fake(
  name: string,
  id: "fmp" | "finnhub",
  quality: MarketDataQuality,
  behaviour: "answers" | "throws" | "empty",
  price = 100
): FakeProvider {
  return {
    providerName: name,
    providerId: id,
    quality,
    streamMode: "rest_polling",
    getQuote: vi.fn(async () => {
      if (behaviour === "throws") throw new Error(`${name} nicht erreichbar`);
      if (behaviour === "empty") return null;
      return quoteFrom(name, quality, price);
    }),
    getQuotes: async () => []
  };
}

// Die Kette erwartet die interne QuoteProvider-Schnittstelle. Die Attrappen
// erfuellen sie strukturell; der Cast haelt den Test frei von Netzwerkcode.
const chainOf = (...providers: FakeProvider[]) =>
  new ChainedQuoteProvider(providers as unknown as ConstructorParameters<typeof ChainedQuoteProvider>[0]);

describe("Ausfall der ersten Kursquelle", () => {
  it("weicht auf die zweite aus, wenn die erste einen Fehler wirft", async () => {
    const primary = fake("FMP", "fmp", "delayed", "throws");
    const secondary = fake("Finnhub", "finnhub", "near_realtime", "answers", 313.33);

    const quote = await chainOf(primary, secondary).getQuote("AAPL");

    expect(quote?.price).toBe(313.33);
    expect(primary.getQuote).toHaveBeenCalledTimes(1);
    expect(secondary.getQuote).toHaveBeenCalledTimes(1);
  });

  it("weicht auch aus, wenn die erste nur nichts liefert", async () => {
    // Ein leeres Ergebnis ist genauso ein Ausfall wie ein Fehler -- der Nutzer
    // merkt keinen Unterschied.
    const primary = fake("FMP", "fmp", "delayed", "empty");
    const secondary = fake("Finnhub", "finnhub", "near_realtime", "answers", 313.33);

    expect((await chainOf(primary, secondary).getQuote("AAPL"))?.price).toBe(313.33);
  });

  it("fragt die zweite gar nicht erst, wenn die erste antwortet", async () => {
    // Sonst wuerde jede Anfrage doppelt Kosten verursachen.
    const primary = fake("FMP", "fmp", "delayed", "answers", 312.0);
    const secondary = fake("Finnhub", "finnhub", "near_realtime", "answers", 313.33);

    const quote = await chainOf(primary, secondary).getQuote("AAPL");

    expect(quote?.price).toBe(312.0);
    expect(secondary.getQuote).not.toHaveBeenCalled();
  });

  it("gibt nichts zurück, wenn keine Quelle antwortet", async () => {
    // Null heisst ehrlich "nichts bekommen". Der Aufrufer entscheidet ueber den
    // Mock-Rueckfall -- die Kette erfindet keinen Kurs.
    const chain = chainOf(
      fake("FMP", "fmp", "delayed", "throws"),
      fake("Finnhub", "finnhub", "near_realtime", "throws")
    );

    expect(await chain.getQuote("AAPL")).toBeNull();
  });

  it("trägt Name und Qualität der antwortenden Quelle, nicht der bevorzugten", async () => {
    // Der Kern: ein near-realtime-Kurs von Finnhub darf nicht als verzoegerter
    // FMP-Kurs erscheinen.
    const quote = await chainOf(
      fake("FMP", "fmp", "delayed", "throws"),
      fake("Finnhub", "finnhub", "near_realtime", "answers", 313.33)
    ).getQuote("AAPL");

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
      fake("FMP", "fmp", "delayed", "answers", 312.0)
    ).getQuote("AAPL");

    expect(quote?.provider).toBe("FMP");
    expect(quote?.quality).toBe("delayed");
  });
});
