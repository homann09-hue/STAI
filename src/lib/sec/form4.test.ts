import { describe, expect, it } from "vitest";
import { insiderRole, parseForm4, summarizeInsiderActivity, transactionCodes } from "@/lib/sec/form4";

/**
 * Der Kern von §32 ist ein einziger Satz: „Unterscheide echte Open-Market-Käufe
 * von Compensation, Optionsausübung, automatischen Verkaufsprogrammen."
 *
 * Die Tests sind deshalb um den Fall herum gebaut, der bei Apple tatsächlich
 * gemessen wurde und ein naives Modell in die Irre führt.
 */

function form4(transactions: string, owner = "") {
  return `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerName>Apple Inc.</issuerName><issuerTradingSymbol>AAPL</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerName>Newstead Jennifer</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship>
      <isOfficer>1</isOfficer>
      <officerTitle>SVP, GC and Secretary</officerTitle>
      ${owner}
    </reportingOwnerRelationship>
  </reportingOwner>
  ${transactions}
</ownershipDocument>`;
}

function nonDerivative(code: string, shares: number, price: number | null, disposed = false) {
  return `<nonDerivativeTransaction>
    <transactionDate><value>2026-06-15</value></transactionDate>
    <transactionCoding><transactionCode>${code}</transactionCode></transactionCoding>
    <transactionAmounts>
      <transactionShares><value>${shares}</value></transactionShares>
      ${price === null ? "" : `<transactionPricePerShare><value>${price}</value></transactionPricePerShare>`}
      <transactionAcquiredDisposedCode><value>${disposed ? "D" : "A"}</value></transactionAcquiredDisposedCode>
    </transactionAmounts>
    <postTransactionAmounts>
      <sharesOwnedFollowingTransaction><value>${disposed ? 41546 : 57784}</value></sharesOwnedFollowingTransaction>
    </postTransactionAmounts>
  </nonDerivativeTransaction>`;
}

describe("der Fall, der ein naives Modell täuscht", () => {
  // Am 2026-08-08 aus der echten Apple-Meldung 0001140361-26-025622 uebernommen.
  const filing = parseForm4(form4(`${nonDerivative("M", 30104, null)}${nonDerivative("F", 16238, 296.42, true)}`));

  it("liest Person und Position", () => {
    expect(filing?.person).toBe("Newstead Jennifer");
    expect(filing?.transactions[0].position).toBe("SVP, GC and Secretary");
    expect(filing?.transactions[0].isOfficer).toBe(true);
    expect(filing?.transactions[0].isDirector).toBe(false);
  });

  it("nennt die Optionsausübung eine Optionsausübung, keinen Kauf", () => {
    // 30.104 Aktien wurden erworben -- gekauft hat sie niemand.
    const exercise = filing?.transactions[0];

    expect(exercise?.direction).toBe("acquired");
    expect(exercise?.kind).toBe("option_exercise");
    expect(exercise?.kind).not.toBe("open_market_buy");
    expect(exercise?.codeLabel).toContain("Optionen");
  });

  it("nennt den Steuereinbehalt keinen Verkauf", () => {
    const withholding = filing?.transactions[1];

    expect(withholding?.direction).toBe("disposed");
    expect(withholding?.kind).toBe("tax_withholding");
    expect(withholding?.kind).not.toBe("open_market_sell");
  });

  it("meldet für diesen Fall keine Marktaktivität", () => {
    // Der entscheidende Test: aus dieser Meldung darf kein Insidersignal
    // entstehen.
    const summary = summarizeInsiderActivity(filing?.transactions ?? []);

    expect(summary.hasMarketActivity).toBe(false);
    expect(summary.openMarketBuys).toBe(0);
    expect(summary.buyValue).toBe(0);
    expect(summary.optionExerciseCount).toBe(1);
    expect(summary.interpretation).toContain("sagen nichts über die Einschätzung");
  });
});

describe("Werte und Lücken", () => {
  it("rechnet den Transaktionswert aus Stück und Preis", () => {
    const filing = parseForm4(form4(nonDerivative("P", 1000, 250.5)));
    const transaction = filing?.transactions[0];

    expect(transaction?.shares).toBe(1000);
    expect(transaction?.pricePerShare).toBe(250.5);
    expect(transaction?.value).toBe(250_500);
  });

  it("macht aus einem fehlenden Preis keine Null", () => {
    // Zuteilungen haben keinen Preis. Ein Wert von 0 waere die Behauptung, es
    // sei kostenlos gekauft worden.
    const filing = parseForm4(form4(nonDerivative("A", 5000, null)));
    const transaction = filing?.transactions[0];

    expect(transaction?.pricePerShare).toBeNull();
    expect(transaction?.value).toBeNull();
    expect(transaction?.kind).toBe("compensation");
  });

  it("behandelt einen Preis von 0 wie einen fehlenden", () => {
    const filing = parseForm4(form4(nonDerivative("A", 5000, 0)));

    expect(filing?.transactions[0].pricePerShare).toBeNull();
  });

  it("liest den Bestand nach der Transaktion", () => {
    const filing = parseForm4(form4(nonDerivative("P", 100, 200)));
    expect(filing?.transactions[0].sharesOwnedAfter).toBe(57784);
  });

  it("meldet einen unbekannten Code als unbekannt", () => {
    // Eine Luecke im Katalog darf nicht wie eine Einordnung aussehen.
    const filing = parseForm4(form4(nonDerivative("Q", 10, 5)));

    expect(filing?.transactions[0].codeLabel).toContain("Unbekannter Code Q");
  });
});

describe("automatische Verkaufsprogramme", () => {
  it("erkennt Rule 10b5-1 aus dem Fußnotentext", () => {
    const xml = form4(nonDerivative("S", 5000, 300)).replace(
      "</ownershipDocument>",
      "<footnotes><footnote id=\"F1\">Sale under a Rule 10b5-1 trading plan adopted on 2025-11-03.</footnote></footnotes></ownershipDocument>"
    );

    expect(parseForm4(xml)?.transactions[0].isPlanned).toBe(true);
  });

  it("erkennt Rule 10b5-1 aus dem eigenen Feld", () => {
    const xml = form4(nonDerivative("S", 5000, 300)).replace(
      "</ownershipDocument>",
      "<aff10b5One><value>1</value></aff10b5One></ownershipDocument>"
    );

    expect(parseForm4(xml)?.transactions[0].isPlanned).toBe(true);
  });

  it("nennt einen geplanten Verkauf kein Signal", () => {
    const xml = form4(nonDerivative("S", 5000, 300)).replace(
      "</ownershipDocument>",
      "<aff10b5One><value>1</value></aff10b5One></ownershipDocument>"
    );
    const summary = summarizeInsiderActivity(parseForm4(xml)?.transactions ?? []);

    expect(summary.plannedCount).toBe(1);
    expect(summary.interpretation).toContain("Monate im Voraus");
  });

  it("hält eine Meldung ohne Planhinweis für ungeplant", () => {
    const filing = parseForm4(form4(nonDerivative("S", 5000, 300)));
    expect(filing?.transactions[0].isPlanned).toBe(false);
  });

  it("zählt für die Aussage nur geplante Markttransaktionen", () => {
    // Der Fehler, den die Live-Probe an echten Apple-Daten aufgedeckt hat: der
    // erste Entwurf verglich alle geplanten Vorgaenge mit der Zahl der
    // Markttransaktionen. Beide standen zufaellig bei 6 -- und die
    // Zusammenfassung meldete "alle geplant", obwohl drei Verkaeufe ueber
    // 86,7 Mio. $ ohne Planhinweis darunter waren.
    //
    // Hier nachgestellt: ein ungeplanter Verkauf, dazu zwei geplante
    // Nicht-Markt-Vorgaenge. Zahlengleichheit, aber inhaltlich das Gegenteil.
    const planned = parseForm4(
      form4(`${nonDerivative("M", 100, null)}${nonDerivative("F", 40, 300, true)}`)!.replace(
        "</ownershipDocument>",
        "<aff10b5One><value>1</value></aff10b5One></ownershipDocument>"
      )
    );
    const unplanned = parseForm4(form4(nonDerivative("S", 5000, 300, true)));

    const summary = summarizeInsiderActivity([
      ...(planned?.transactions ?? []),
      ...(unplanned?.transactions ?? [])
    ]);

    expect(summary.plannedCount).toBe(2);
    expect(summary.plannedMarketCount).toBe(0);
    expect(summary.interpretation).not.toContain("Alle Markttransaktionen");
  });
});

describe("Position", () => {
  it("nennt die Rolle, wenn kein Titel gemeldet ist", () => {
    // Aufsichtsratsmitglieder haben keinen `officerTitle`. An echten Daten
    // betraf das den Verkaeufer der groessten Position des Zeitraums.
    const xml = form4(nonDerivative("S", 100, 280, true))
      .replace("<isOfficer>1</isOfficer>", "<isDirector>1</isDirector>")
      .replace("<officerTitle>SVP, GC and Secretary</officerTitle>", "");
    const transaction = parseForm4(xml)!.transactions[0];

    expect(transaction.position).toBeNull();
    expect(insiderRole(transaction)).toBe("Verwaltungsrat");
  });

  it("bevorzugt den gemeldeten Titel", () => {
    const transaction = parseForm4(form4(nonDerivative("P", 10, 100)))!.transactions[0];
    expect(insiderRole(transaction)).toBe("SVP, GC and Secretary");
  });

  it("erfindet keine Position", () => {
    const xml = form4(nonDerivative("P", 10, 100))
      .replace("<isOfficer>1</isOfficer>", "")
      .replace("<officerTitle>SVP, GC and Secretary</officerTitle>", "");

    expect(insiderRole(parseForm4(xml)!.transactions[0])).toBe("Position nicht angegeben");
  });
});

describe("Zusammenfassung", () => {
  it("rechnet Zuteilungen nicht in die Kaufsumme", () => {
    // Der uebliche Fehler: alle Erwerbe addieren und "Insider kaufen" melden.
    const filing = parseForm4(
      form4(`${nonDerivative("P", 100, 300)}${nonDerivative("A", 10_000, null)}${nonDerivative("M", 5_000, null)}`)
    );
    const summary = summarizeInsiderActivity(filing?.transactions ?? []);

    expect(summary.openMarketBuys).toBe(1);
    expect(summary.buyValue).toBe(30_000);
    expect(summary.compensationCount).toBe(1);
    expect(summary.optionExerciseCount).toBe(1);
  });

  it("hebt Käufe gegenüber Verkäufen in der Aussage hervor", () => {
    const filing = parseForm4(form4(`${nonDerivative("P", 100, 300)}${nonDerivative("S", 50, 310, true)}`));
    const summary = summarizeInsiderActivity(filing?.transactions ?? []);

    expect(summary.interpretation).toContain("Käufe mit eigenem Geld sind aussagekräftiger");
  });

  it("sagt bei leerer Liste nichts", () => {
    const summary = summarizeInsiderActivity([]);

    expect(summary.hasMarketActivity).toBe(false);
    expect(summary.interpretation).toContain("Keine gemeldeten Transaktionen");
  });
});

describe("Robustheit und Katalog", () => {
  it("liest auch Derivate-Transaktionen", () => {
    // Ohne sie fehlte die Optionsausuebung selbst und man saehe nur ihre Folgen.
    const xml = form4(
      `<derivativeTransaction>
        <transactionDate><value>2026-06-15</value></transactionDate>
        <transactionCoding><transactionCode>X</transactionCode></transactionCoding>
        <transactionAmounts>
          <transactionShares><value>2000</value></transactionShares>
          <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
        </transactionAmounts>
      </derivativeTransaction>`
    );

    expect(parseForm4(xml)?.transactions[0].kind).toBe("option_exercise");
  });

  it("verträgt fremde und leere Dokumente", () => {
    expect(parseForm4("")).toBeNull();
    expect(parseForm4("<html><body>Fehlerseite</body></html>")).toBeNull();
    expect(parseForm4("<ownershipDocument></ownershipDocument>")).toBeNull();
  });

  it("liefert bei einer Meldung ohne Transaktionen eine leere Liste", () => {
    expect(parseForm4(form4(""))?.transactions).toEqual([]);
  });

  it("ordnet nur P und S dem Markt zu", () => {
    // Die wichtigste Zusicherung des Katalogs. Waere ein weiterer Code als
    // Marktgeschaeft eingestuft, entstuende genau das Signal, das §32
    // ausschliessen will.
    const marketCodes = Object.entries(transactionCodes)
      .filter(([, entry]) => entry.kind === "open_market_buy" || entry.kind === "open_market_sell")
      .map(([code]) => code);

    expect(marketCodes.sort()).toEqual(["P", "S"]);
  });
});
