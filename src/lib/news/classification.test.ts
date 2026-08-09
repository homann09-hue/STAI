import { describe, expect, it } from "vitest";
import { classifySubjects, detectEvents, type ProviderEntity } from "@/lib/news/classification";

/**
 * §27 verlangt 18 Ereignisarten und eine Einordnung nach Bezug.
 *
 * Ein Schlagwortklassifikator scheitert nicht daran, dass er ein Stichwort
 * übersieht — sondern daran, dass er eines findet, das etwas anderes meint.
 * Die Tests prüfen deshalb überwiegend die Gegenrichtung: was **nicht**
 * erkannt werden darf.
 */

function types(title: string, summary = "") {
  return detectEvents(title, summary).map((event) => event.type);
}

describe("Ereignisarten erkennen", () => {
  it("erkennt die verlangten Arten", () => {
    expect(types("Apple reports Q3 earnings")).toContain("earnings");
    expect(types("Siemens raises full-year guidance")).toContain("guidance");
    expect(types("Bayer issues profit warning")).toContain("profit_warning");
    expect(types("Goldman upgrades Tesla to buy")).toContain("analyst_change");
    expect(types("Microsoft acquires Nuance for $19bn")).toContain("acquisition");
    expect(types("The two banks agreed to merge with each other")).toContain("merger");
    expect(types("Lufthansa announces capital increase")).toContain("capital_measure");
    expect(types("Apple expands buyback program")).toContain("buyback");
    expect(types("Coca-Cola raises dividend by 5%")).toContain("dividend_change");
    expect(types("Boeing CEO steps down after safety review")).toContain("management_change");
    expect(types("CFO sells 40,000 shares")).toContain("insider_transaction");
    expect(types("Company files 8-K with the SEC")).toContain("sec_filing");
    expect(types("Investors file class action against the firm")).toContain("litigation");
    expect(types("FDA approves the new treatment")).toContain("regulatory_decision");
    expect(types("Samsung unveils new foldable device")).toContain("product_launch");
    expect(types("Chip shortage delays production")).toContain("supply_chain");
    expect(types("Rheinmetall wins contract worth 1bn")).toContain("major_contract");
    expect(types("Nvidia partners with Siemens on industrial AI")).toContain("partnership");
  });

  it("versteht auch deutsche Meldungen", () => {
    expect(types("SAP hebt Prognose an")).toContain("guidance");
    expect(types("Konzern meldet Gewinnwarnung")).toContain("profit_warning");
    expect(types("Aktienrückkauf über 2 Milliarden Euro")).toContain("buyback");
    expect(types("Vorstandswechsel bei der Deutschen Bank")).toContain("management_change");
  });

  it("erkennt mehrere Arten in einer Meldung", () => {
    // Richtig so: eine Meldung kann Zahlen und eine Prognoseaenderung
    // gleichzeitig enthalten.
    const found = types("Apple reports Q3 earnings and raises its full-year guidance");

    expect(found).toContain("earnings");
    expect(found).toContain("guidance");
  });
});

describe("was nicht erkannt werden darf", () => {
  it("hält eine Dividendenrendite nicht für eine Dividendenänderung", () => {
    // Der haeufigste Fehlalarm: das Stichwort steht da, meint aber etwas
    // anderes.
    expect(types("Stock offers a dividend yield of 3.4%")).not.toContain("dividend_change");
    expect(types("Best dividend stocks for 2026")).not.toContain("dividend_change");
  });

  it("hält ein Software-Update nicht für eine Analystenänderung", () => {
    expect(types("Company rolls out a major software upgrade")).not.toContain("analyst_change");
  });

  it("hält Kundenakquise nicht für eine Übernahme", () => {
    expect(types("Customer acquisition costs rose sharply")).not.toContain("acquisition");
  });

  it("hält einen Merger-Arbitrage-Fonds nicht für eine Fusion", () => {
    expect(types("Merger arbitrage fund posts strong returns")).not.toContain("merger");
  });

  it("hält einen Termin nicht für die Zahlen selbst", () => {
    expect(types("Ahead of its earnings, analysts stay cautious")).not.toContain("earnings");
    expect(types("Earnings season preview: what to watch")).not.toContain("earnings");
  });

  it("hält ein Gerücht nicht für eine Produkteinführung", () => {
    expect(types("Apple is expected to launch a new device next year")).not.toContain("product_launch");
    expect(types("Leaks suggest the company will unveil a new phone")).not.toContain("product_launch");
  });

  it("liefert ohne Treffer eine leere Liste statt einer Auffangkategorie", () => {
    // Eine Kategorie "Sonstiges" saehe aus wie eine Einordnung und waere keine.
    expect(detectEvents("Markets drift sideways in quiet trading")).toEqual([]);
    expect(detectEvents("")).toEqual([]);
  });
});

describe("Beleg der Einordnung", () => {
  it("trägt den auslösenden Wortlaut mit", () => {
    // §104 verbietet die Black Box. Wer sieht, warum eingeordnet wurde, kann
    // den Fehlschluss selbst erkennen.
    const [event] = detectEvents("Microsoft acquires Nuance Communications");

    expect(event.matchedText.toLowerCase()).toContain("acquires");
    expect(event.label).toBe("Übernahme");
  });
});

describe("Bezüge einordnen", () => {
  const entity: ProviderEntity = {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "equity",
    industry: "Technology",
    country: "us",
    matchScore: 26.9
  };

  it("nimmt Unternehmen, Branche und Land aus den Anbieterdaten", () => {
    const subjects = classifySubjects([entity]);
    const byType = Object.fromEntries(subjects.map((subject) => [subject.type, subject]));

    expect(byType.company.label).toBe("Apple Inc.");
    expect(byType.industry.label).toBe("Technology");
    expect(byType.country.label).toBe("USA");
    expect(subjects.every((subject) => subject.origin === "provider")).toBe(true);
  });

  it("unterscheidet Index, Rohstoff, Währung und Krypto am Symbol", () => {
    const kinds = (symbol: string) => classifySubjects([{ symbol, matchScore: 1 }])[0];

    expect(kinds("^GSPC").type).toBe("index");
    expect(kinds("GCUSD").type).toBe("commodity");
    expect(kinds("GCUSD").label).toBe("Gold");
    expect(kinds("BTC-USD").type).toBe("crypto");
    expect(kinds("EURUSD").type).toBe("currency");
    expect(kinds("SAP").type).toBe("company");
  });

  it("rät Branche und Land nicht aus dem Titel", () => {
    // Ohne Anbieterangabe gibt es keinen Bezug. Aus einer Schlagzeile auf ein
    // Land zu schliessen waere eine Erfindung.
    const subjects = classifySubjects([{ symbol: "TSLA", matchScore: 5 }]);

    expect(subjects.some((subject) => subject.type === "industry")).toBe(false);
    expect(subjects.some((subject) => subject.type === "country")).toBe(false);
  });

  it("kennzeichnet den Rückfall auf das abgefragte Symbol als abgeleitet", () => {
    // Der Unterschied entscheidet ueber die Verlaesslichkeit und gehoert
    // deshalb sichtbar.
    const subjects = classifySubjects([], "MSFT");

    expect(subjects).toHaveLength(1);
    expect(subjects[0].origin).toBe("symbol");
    expect(subjects[0].matchScore).toBeNull();
  });

  it("greift nicht auf das Symbol zurück, wenn der Anbieter etwas erkannt hat", () => {
    const subjects = classifySubjects([entity], "MSFT");

    expect(subjects.some((subject) => subject.id === "MSFT")).toBe(false);
  });

  it("führt Doppelnennungen zusammen und behält den höheren Wert", () => {
    const subjects = classifySubjects([
      { symbol: "AAPL", name: "Apple", matchScore: 5 },
      { symbol: "AAPL", name: "Apple Inc.", matchScore: 30 }
    ]);

    expect(subjects.filter((subject) => subject.type === "company")).toHaveLength(1);
    expect(subjects[0].matchScore).toBe(30);
  });

  it("sortiert nach Gewichtung des Anbieters", () => {
    const subjects = classifySubjects([
      { symbol: "MSFT", matchScore: 3 },
      { symbol: "AAPL", matchScore: 40 }
    ]);

    expect(subjects[0].id).toBe("AAPL");
  });
});
