import { describe, expect, it } from "vitest";
import { aggregateByAccount, type UsageRow } from "@/lib/cost/usage-recorder";

/**
 * Die Aggregation beantwortet die Frage „wer kostet was". Die Tests prüfen vor
 * allem, dass dabei nichts verschwindet und nichts erfunden wird.
 */

function row(overrides: Partial<UsageRow> = {}): UsageRow {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    plan: "pro",
    provider: "fmp",
    fetches: 10,
    cache_hits: 90,
    ...overrides
  };
}

describe("aggregateByAccount", () => {
  it("fasst mehrere Anbieter zu einem Konto zusammen", () => {
    const accounts = aggregateByAccount([
      row({ provider: "fmp", fetches: 100, cache_hits: 0 }),
      row({ provider: "ai_model", fetches: 10, cache_hits: 0 })
    ]);

    expect(accounts).toHaveLength(1);
    // 100 Abrufe zu 1 plus 10 zu 20 Zehntel-Cent.
    expect(accounts[0].costTenthCents).toBe(300);
    expect(accounts[0].fetches).toBe(110);
  });

  it("hält Konten auseinander", () => {
    const accounts = aggregateByAccount([
      row({ user_id: "aaaa", fetches: 100 }),
      row({ user_id: "bbbb", fetches: 5 })
    ]);

    expect(accounts).toHaveLength(2);
    // Teuerste zuerst -- die Liste soll die Frage "wer kostet am meisten"
    // beantworten, nicht alphabetisch sortieren.
    expect(accounts[0].userId).toBe("aaaa");
  });

  it("lässt Abrufe ohne Konto nicht verschwinden", () => {
    // Sie sind Teil der Gesamtkosten, nur keinem Tarif zurechenbar.
    const accounts = aggregateByAccount([row({ user_id: null, plan: "free", fetches: 40 })]);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBeNull();
    expect(accounts[0].costTenthCents).toBe(40);
  });

  it("wirft mehrere anonyme Zeilen in einen Topf", () => {
    const accounts = aggregateByAccount([
      row({ user_id: null, provider: "fmp", fetches: 10 }),
      row({ user_id: null, provider: "ai_model", fetches: 1 })
    ]);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].costTenthCents).toBe(30);
  });

  it("führt einen unbekannten Anbieter mit null statt ihn zu raten", () => {
    // Einen Preis zu schaetzen waere schlimmer, als sichtbar null zu fuehren.
    const accounts = aggregateByAccount([row({ provider: "unbekannter_dienst", fetches: 1_000 })]);

    expect(accounts[0].costTenthCents).toBe(0);
    expect(accounts[0].fetches).toBe(1_000);
  });

  it("stuft einen unbekannten Tarif auf Free zurück", () => {
    // Ein erfundener Tarifname darf nicht zu einer erfundenen Ertragsseite
    // fuehren.
    const accounts = aggregateByAccount([row({ plan: "enterprise_gold" })]);
    expect(accounts[0].plan).toBe("free");
  });

  it("zählt Cache-Treffer mit, ohne sie zu berechnen", () => {
    const accounts = aggregateByAccount([row({ fetches: 5, cache_hits: 95 })]);

    expect(accounts[0].cacheHits).toBe(95);
    expect(accounts[0].costTenthCents).toBe(5);
  });

  it("gibt ohne Zeilen eine leere Liste zurück", () => {
    expect(aggregateByAccount([])).toEqual([]);
  });
});
