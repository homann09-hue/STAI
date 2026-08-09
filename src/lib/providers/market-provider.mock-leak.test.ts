import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockAsset } from "@/lib/mock/market";

/**
 * §61 verbietet Demodaten in der Produktion. Der Verstoß war nicht, dass es
 * `mock/market.ts` gibt — sondern dass `getAsset()` damit **anfing**:
 *
 * ```ts
 * const detail = await this.fallback.getAsset(symbol);   // Mock-Gerüst
 * return quote ? enrichAssetWithQuote(detail, quote) : detail;
 * ```
 *
 * `enrichAssetWithQuote` ersetzte genau zwei Felder: `quote` und
 * `dataQuality`. Für die sechs Symbole der Mock-Tabelle überlebte alles andere
 * bis in die Anzeige — Scores, Fundamentaldaten, News, Insider-Trades,
 * Earnings-Datum. Neben einem echten Kurs, ohne Unterschied in der Darstellung.
 *
 * Dass 774 Tests grün blieben, als ich das entfernt habe, ist der eigentliche
 * Befund: **keiner deckte es ab.** Diese Datei schließt die Lücke.
 */

vi.mock("@/lib/providers/http-json", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/http-json")>();
  return {
    ...actual,
    // Eine Finnhub-Antwort mit einem Kurs, der in keiner Mock-Tabelle steht.
    fetchBoundedProviderJson: vi.fn(async () => ({
      data: { c: 313.42, pc: 310.1, d: 3.32, dp: 1.07, h: 314, l: 309.5, o: 310.5, t: 1786320000 },
      latencyMs: 12
    }))
  };
});

vi.mock("@/lib/providers/price-history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/price-history")>();
  return {
    ...actual,
    // Keine Historie. Genau der Fall, in dem frueher am ehesten etwas
    // Erfundenes eingesprungen waere.
    fetchDailyHistory: vi.fn(async () => actual.NO_HISTORY)
  };
});

const env = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.MARKET_DATA_PROVIDER = "finnhub";
  process.env.FINNHUB_API_KEY = "test-key";
});

afterEach(() => {
  process.env = { ...env };
  vi.clearAllMocks();
});

async function loadAsset(symbol: string) {
  const { getMarketDataProvider } = await import("@/lib/providers/market-provider");
  return getMarketDataProvider().getAsset(symbol);
}

describe("Asset-Pfad mit konfiguriertem Anbieter", () => {
  it("liefert für ein Mock-Symbol keine Mock-Fundamentaldaten mehr", async () => {
    // AAPL steht in `fundamentalsMap`. Frueher kamen KGV, Wachstum und
    // Verschuldung von dort -- neben einem echten Kurs.
    const seeded = getMockAsset("AAPL");
    expect(seeded?.fundamentals.peRatio).not.toBeNull();

    const detail = await loadAsset("AAPL");

    expect(detail).not.toBeNull();
    expect(detail!.quote.price).toBe(313.42);
    expect(detail!.fundamentals.peRatio).toBeNull();
    expect(detail!.fundamentals.peRatio).not.toBe(seeded!.fundamentals.peRatio);
    expect(detail!.fundamentals.revenueGrowth).toBe(0);
  });

  it("liefert keine erfundenen Nachrichten", async () => {
    expect(getMockAsset("AAPL")!.news.length).toBeGreaterThan(0);

    expect((await loadAsset("AAPL"))!.news).toEqual([]);
  });

  it("liefert keine erfundenen Insider-Geschäfte", async () => {
    // Der Mock kannte fuer AAPL einen "Executive Officer", der fuer 1,8 Mio.
    // Dollar verkauft haben soll. Das ist eine Aussage ueber eine reale
    // Person bei einem realen Unternehmen.
    const detail = await loadAsset("AAPL");

    expect(detail!.insiderActivity).toEqual([]);
    expect(detail!.earningsDate).toBeNull();
  });

  it("leitet die Scores aus dem Quote ab, nicht aus der Seed-Tabelle", async () => {
    // scoreSeeds: AAPL { trend: 46, news: 52, fundamental: 73, technical: 43 }.
    // Diese Zahlen haben mit dem Symbol nichts zu tun -- sie stehen im Code.
    const seededScores = getMockAsset("AAPL")!.scores;
    const detail = await loadAsset("AAPL");

    expect(detail!.scores.trend).not.toBe(seededScores.trend);
    expect(detail!.scores.fundamental).not.toBe(seededScores.fundamental);
  });

  it("benennt die Lücken, statt sie zu füllen", async () => {
    const detail = await loadAsset("AAPL");

    expect(detail!.aiAnalysis.dataGaps.join(" ")).toMatch(/Fundamentaldaten fehlen/);
    expect(detail!.riskReport.blockedAnalysis).toBe(true);
    expect(detail!.analysisLayers.some((layer) => layer.status === "risk")).toBe(true);
  });

  it("behandelt ein unbekanntes Symbol genauso wie ein Mock-Symbol", async () => {
    // Der Kern der Aenderung: es gibt keine zwei Klassen von Symbolen mehr.
    const known = await loadAsset("AAPL");
    const unknown = await loadAsset("ZZZZ");

    expect(known!.fundamentals).toEqual(unknown!.fundamentals);
    expect(known!.news).toEqual(unknown!.news);
    expect(known!.insiderActivity).toEqual(unknown!.insiderActivity);
    expect(known!.riskReport.blockedAnalysis).toBe(unknown!.riskReport.blockedAnalysis);
  });

  it("gibt ohne Quote null zurück, statt auf den Mock zurückzufallen", async () => {
    const httpJson = await import("@/lib/providers/http-json");
    vi.mocked(httpJson.fetchBoundedProviderJson).mockResolvedValueOnce({
      data: { c: 0 },
      latencyMs: 5
    } as never);

    // Bewusst ein Symbol, das in diesem Lauf noch nicht geholt wurde -- sonst
    // antwortet der Quote-Cache und der Anbieter wird gar nicht gefragt.
    // Frueher haette hier fuer AAPL das vollstaendige Mock-Asset gestanden:
    // falscher Kurs, falsche Fundamentaldaten, alles.
    expect(await loadAsset("MSFT")).toBeNull();
  });
});
