import { describe, expect, it } from "vitest";
import { clusterNews, titleSimilarity } from "@/lib/news/dedupe";
import type { NewsItem } from "@/lib/types";

/**
 * Der Fehler, gegen den hier gebaut wird, ist der zweite, nicht der erste: ein
 * zu eifriger Vergleich lässt eine echte Meldung verschwinden. Ein doppelter
 * Eintrag ist lästig, eine verschluckte Gewinnwarnung ist gefährlich.
 *
 * Die Tests bestehen deshalb überwiegend aus Fällen, die **nicht**
 * zusammengeführt werden dürfen.
 */

function item(overrides: Partial<NewsItem> & { id: string; title: string }): NewsItem {
  return {
    symbol: "AAPL",
    source: "Reuters",
    publishedAt: "2026-08-07T10:00:00.000Z",
    relevance: 20,
    sentiment: "neutral",
    impactScore: null,
    summary: "",
    url: "#",
    events: [],
    subjects: [],
    duplicateSources: [],
    ...overrides
  };
}

describe("Titelähnlichkeit", () => {
  it("erkennt dieselbe Meldung in anderer Formulierung", () => {
    const value = titleSimilarity(
      "Apple acquires chipmaker Nuvia for 2 billion dollars",
      "Apple to acquire chipmaker Nuvia in 2 billion dollar deal"
    );

    expect(value).toBeGreaterThan(0.6);
  });

  it("hält zwei verschiedene Meldungen auseinander", () => {
    const value = titleSimilarity(
      "Apple acquires chipmaker Nuvia",
      "Apple faces antitrust probe in Brussels"
    );

    expect(value).toBeLessThan(0.3);
  });

  it("verweigert die Aussage bei zu wenigen unterscheidenden Wörtern", () => {
    // Bleiben nach dem Filtern ein oder zwei Woerter uebrig, sind zwei voellig
    // verschiedene Schlagzeilen zu 100 % aehnlich. Genau dieser Fall stand im
    // ersten Entwurf und blieb bei der Gegenprobe zunaechst unbemerkt, weil ihn
    // kein Test traf.
    expect(titleSimilarity("Apple Inc.", "Apple Corp")).toBe(0);
    expect(titleSimilarity("Tesla stock", "Tesla stock")).toBe(0);
  });

  it("zählt Füllwörter nicht als Übereinstimmung", () => {
    // Ohne Stoppwortfilter aehneln sich zwei beliebige Schlagzeilen bereits zu
    // einem Drittel -- und die Schwelle waere wertlos.
    const value = titleSimilarity(
      "The company said it will report on the market",
      "The company said it has a new stock in the market"
    );

    expect(value).toBeLessThan(0.6);
  });
});

describe("Zusammenführen", () => {
  it("fasst dieselbe Meldung aus mehreren Häusern zusammen", () => {
    const { clusters, mergedCount } = clusterNews([
      item({ id: "a", title: "Nvidia beats quarterly revenue estimates", source: "Reuters", publishedAt: "2026-08-07T10:00:00.000Z" }),
      item({ id: "b", title: "Nvidia beats quarterly revenue estimates again", source: "Bloomberg", publishedAt: "2026-08-07T11:00:00.000Z" }),
      item({ id: "c", title: "Nvidia beats estimates for quarterly revenue", source: "Yahoo", publishedAt: "2026-08-07T12:00:00.000Z" })
    ]);

    expect(clusters).toHaveLength(1);
    expect(mergedCount).toBe(2);
    expect(clusters[0].sources).toEqual(["Reuters", "Bloomberg", "Yahoo"]);
  });

  it("behält die zuerst veröffentlichte Meldung", () => {
    // Wer zuerst berichtet hat, hat berichtet. Jede andere Wahl waere eine
    // Wertung der Quellen.
    const { clusters } = clusterNews([
      item({ id: "spaet", title: "Bayer issues profit warning for the year", publishedAt: "2026-08-07T18:00:00.000Z", source: "Yahoo" }),
      item({ id: "frueh", title: "Bayer issues a profit warning for this year", publishedAt: "2026-08-07T08:00:00.000Z", source: "Reuters" })
    ]);

    expect(clusters[0].primary.id).toBe("frueh");
  });

  it("erkennt dieselbe Seite trotz Kampagnenparametern", () => {
    const { clusters } = clusterNews([
      item({ id: "a", title: "Erste Fassung", url: "https://example.com/news/story?utm_source=x" }),
      item({ id: "b", title: "Vollkommen anderer Titel ohne Bezug", url: "https://www.example.com/news/story/" })
    ]);

    expect(clusters).toHaveLength(1);
  });
});

describe("was nicht zusammengeführt werden darf", () => {
  it("trennt gegensätzliche Meldungen mit fast gleichem Wortlaut", () => {
    // Der wichtigste Test der Datei. "beats" und "misses" unterscheiden sich in
    // einem Wort und bedeuten das Gegenteil -- eine davon zu verschlucken waere
    // der schwerste Fehler dieser Funktion.
    const { clusters } = clusterNews([
      item({ id: "a", title: "Apple beats Q3 revenue estimates on strong iPhone demand" }),
      item({ id: "b", title: "Apple misses Q3 revenue estimates on weak iPhone demand" })
    ]);

    expect(clusters).toHaveLength(2);
  });

  it("trennt gleiche Meldungen aus verschiedenen Jahren", () => {
    // Ohne Zeitbedingung fielen die Quartalszahlen dieses und des letzten
    // Jahres zusammen.
    const { clusters } = clusterNews([
      item({ id: "a", title: "Apple reports third quarter results", publishedAt: "2025-08-07T10:00:00.000Z" }),
      item({ id: "b", title: "Apple reports third quarter results", publishedAt: "2026-08-07T10:00:00.000Z" })
    ]);

    expect(clusters).toHaveLength(2);
  });

  it("trennt zwei verschiedene Meldungen über dasselbe Unternehmen", () => {
    const { clusters } = clusterNews([
      item({ id: "a", title: "Tesla opens new gigafactory in Mexico" }),
      item({ id: "b", title: "Tesla recalls 200,000 vehicles over software fault" })
    ]);

    expect(clusters).toHaveLength(2);
  });

  it("führt Meldungen ohne verwertbare Wörter nicht zusammen", () => {
    // Zwei leere Wortmengen sind nicht aehnlich, sondern unbestimmt.
    const { clusters } = clusterNews([item({ id: "a", title: "Das ist" }), item({ id: "b", title: "und zu" })]);

    expect(clusters).toHaveLength(2);
  });
});

describe("Reihenfolge und Randfälle", () => {
  it("gibt die neueste Meldung zuerst zurück", () => {
    const { clusters } = clusterNews([
      item({ id: "alt", title: "Erste Meldung über Rohstoffe", publishedAt: "2026-08-01T10:00:00.000Z" }),
      item({ id: "neu", title: "Zweite Meldung über Halbleiter", publishedAt: "2026-08-07T10:00:00.000Z" })
    ]);

    expect(clusters[0].primary.id).toBe("neu");
  });

  it("verträgt eine leere Liste", () => {
    expect(clusterNews([])).toEqual({ clusters: [], mergedCount: 0 });
  });
});
