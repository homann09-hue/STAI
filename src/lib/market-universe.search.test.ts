import { describe, expect, it } from "vitest";
import { getMarketUniverse } from "@/lib/market-universe";

/**
 * §48 an der Stelle, an der die Suche tatsächlich stattfindet.
 *
 * Vorher stand hier ein wörtlicher `includes()`-Vergleich: er fand „Apple",
 * aber nicht „Aplpe". Diese Tests prüfen die Verdrahtung, nicht den
 * Algorithmus — der hat seine eigenen in `search/fuzzy.test.ts`.
 */

type AssetClass = Parameters<typeof getMarketUniverse>[0] extends infer T
  ? T extends { assetClass?: infer A }
    ? A
    : never
  : never;

async function symbols(query: string, assetClass?: AssetClass) {
  // `getMarketUniverse` liefert die Liste direkt, nicht in einer Huelle.
  const instruments = await getMarketUniverse({ query, assetClass, limit: 20 });
  return instruments.map((instrument) => instrument.symbol);
}

describe("Suche im vorbereiteten Universum", () => {
  it("findet weiterhin wörtlich", async () => {
    expect(await symbols("AAPL")).toContain("AAPL");
    expect(await symbols("Bitcoin")).toContain("BTC-USD");
  });

  it("findet jetzt auch mit Tippfehler", async () => {
    // Der eigentliche Gewinn: vorher fand das nichts.
    expect(await symbols("Mircosoft")).toContain("MSFT");
    expect(await symbols("Amazn")).toContain("AMZN");
  });

  it("sucht weiterhin über Börse, Land und Anlageklasse", async () => {
    // Das konnte die alte Suche, und es darf nicht verlorengehen.
    expect((await symbols("NASDAQ")).length).toBeGreaterThan(2);
    expect((await symbols("crypto")).length).toBeGreaterThan(0);
  });

  it("hält die Einschränkung auf eine Anlageklasse durch", async () => {
    // Wer ETFs sucht, will keine aehnlich geschriebene Aktie. Eine unscharfe
    // Suche darf eine ausdrueckliche Einschraenkung nicht aufweichen.
    const etfs = await symbols("Vanguard", "etf");

    expect(etfs).toContain("VOO");
    expect(etfs).not.toContain("AAPL");
  });

  it("gibt bei Unsinn nichts aus", async () => {
    // Das Aehnlichste auszugeben waere schlimmer als nichts.
    expect(await symbols("qqqwwweeerrr")).toHaveLength(0);
  });

  it("liefert ohne Eingabe die Liste", async () => {
    expect((await symbols("")).length).toBeGreaterThan(5);
  });
});
