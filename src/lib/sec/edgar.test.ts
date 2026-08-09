import { describe, expect, it } from "vitest";
import { filingUrls, parseRecentFilings, rawFilingDocumentUrl, secUserAgent, trackedFilingForms } from "@/lib/sec/edgar";

/**
 * §31 verlangt Originaldokumente mit Link. Die Tests prüfen deshalb vor allem
 * die Linkbildung und die Zuordnung der parallelen Felder — an beiden Stellen
 * würde ein Fehler nicht auffallen, sondern still das falsche Dokument
 * verlinken.
 */

const submissions = {
  name: "Apple Inc.",
  filings: {
    recent: {
      accessionNumber: ["0001140361-26-025622", "0000320193-26-000020", "0000320193-26-000019"],
      form: ["4", "10-Q", "8-K"],
      filingDate: ["2026-06-17", "2026-07-31", "2026-07-30"],
      reportDate: ["2026-06-15", "2026-06-27", ""],
      primaryDocument: ["xslF345X06/form4.xml", "aapl-20260627.htm", "aapl-8k.htm"],
      primaryDocDescription: ["FORM 4", "10-Q", ""]
    }
  }
};

describe("Linkbildung", () => {
  it("baut den Archivpfad nach den Eigenheiten der SEC", () => {
    // Zwei Eigenheiten, die sich nicht ableiten lassen: die CIK ohne fuehrende
    // Nullen, das Aktenzeichen ohne Bindestriche. Gemessen an einem
    // funktionierenden Abruf.
    const { documentUrl, indexUrl } = filingUrls("0000320193", "0001140361-26-025622", "xslF345X06/form4.xml");

    expect(documentUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000114036126025622/xslF345X06/form4.xml"
    );
    expect(indexUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000114036126025622/0001140361-26-025622-index.htm"
    );
  });

  it("verlinkt ohne Hauptdokument das Verzeichnis", () => {
    // Besser das Verzeichnis als ein Link ins Leere.
    expect(filingUrls("0000320193", "0001140361-26-025622", "").documentUrl).toMatch(/\/$/);
  });

  it("verlinkt ausschließlich auf sec.gov", () => {
    const { documentUrl, indexUrl } = filingUrls("320193", "0001-26-1", "x.htm");

    expect(new URL(documentUrl).hostname).toBe("www.sec.gov");
    expect(new URL(indexUrl).hostname).toBe("www.sec.gov");
  });
});

describe("Auswertung der Einreichungsliste", () => {
  it("ordnet die parallelen Felder derselben Zeile zu", () => {
    // Die SEC liefert Felder als parallele Listen. Ein Versatz wuerde jedes
    // Filing dem falschen Datum zuordnen, ohne dass es auffiele.
    const filings = parseRecentFilings("0000320193", submissions);

    expect(filings).toHaveLength(3);
    expect(filings[0].form).toBe("4");
    expect(filings[0].filedAt).toBe("2026-06-17");
    expect(filings[0].reportDate).toBe("2026-06-15");
    expect(filings[1].form).toBe("10-Q");
    expect(filings[1].filedAt).toBe("2026-07-31");
  });

  it("filtert nach Formularart", () => {
    const filings = parseRecentFilings("0000320193", submissions, ["10-Q", "8-K"]);

    expect(filings.map((filing) => filing.form)).toEqual(["10-Q", "8-K"]);
  });

  it("erklärt jede bekannte Formularart", () => {
    const filings = parseRecentFilings("0000320193", submissions);

    expect(filings[0].formExplanation).toContain("Insidertransaktion");
    expect(filings[1].formExplanation).toContain("Quartalsbericht");
  });

  it("macht aus einem leeren Stichtag null statt eines leeren Strings", () => {
    const filings = parseRecentFilings("0000320193", submissions);

    expect(filings[2].reportDate).toBeNull();
    expect(filings[2].description).toBeNull();
  });

  it("überspringt Zeilen mit fehlenden Pflichtfeldern", () => {
    const broken = {
      filings: {
        recent: {
          accessionNumber: ["a-1", "", "a-3"],
          form: ["4", "4", ""],
          filingDate: ["2026-01-01", "2026-01-02", "2026-01-03"],
          primaryDocument: ["x.xml", "y.xml", "z.xml"]
        }
      }
    };

    expect(parseRecentFilings("320193", broken)).toHaveLength(1);
  });

  it("verträgt eine Antwort ohne Filings", () => {
    expect(parseRecentFilings("320193", {})).toEqual([]);
    expect(parseRecentFilings("320193", { filings: {} })).toEqual([]);
    expect(parseRecentFilings("320193", { filings: { recent: {} } })).toEqual([]);
  });

  it("kennt die von §31 genannten Formulararten", () => {
    for (const form of ["10-K", "10-Q", "8-K", "4"]) {
      expect(trackedFilingForms[form]).toBeTruthy();
    }
  });
});

describe("Rohdokument statt Anzeigeansicht", () => {
  it("entfernt den XSL-Pfad aus dem Form-4-Link", () => {
    // Der Fund, der erst bei der Live-Probe auffiel: `primaryDocument` zeigt
    // auf `xslF345X06/form4.xml` -- die ueber ein Stylesheet gerenderte
    // HTML-Ansicht, ausgeliefert als text/html. Das Rohdokument liegt eine
    // Ebene hoeher und kommt als text/xml.
    expect(
      rawFilingDocumentUrl("https://www.sec.gov/Archives/edgar/data/320193/000114036126025622/xslF345X06/form4.xml")
    ).toBe("https://www.sec.gov/Archives/edgar/data/320193/000114036126025622/form4.xml");
  });

  it("verträgt andere XSL-Fassungen", () => {
    // Die SEC nutzt je nach Alter der Meldung xslF345X02 bis X06.
    for (const version of ["xslF345X02", "xslF345X03", "xslF345X05"]) {
      expect(rawFilingDocumentUrl(`https://www.sec.gov/a/b/${version}/form4.xml`)).toBe(
        "https://www.sec.gov/a/b/form4.xml"
      );
    }
  });

  it("lässt einen Link ohne XSL-Pfad unverändert", () => {
    // 10-Q und 8-K werden direkt ausgeliefert -- dort gibt es nichts zu
    // entfernen, und ein zu gieriger Ausdruck wuerde den Pfad zerstoeren.
    const direct = "https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-20260627.htm";
    expect(rawFilingDocumentUrl(direct)).toBe(direct);
  });
});

describe("Kennung gegenüber der SEC", () => {
  it("meldet fehlende Kontaktadresse, statt eine fremde einzusetzen", () => {
    // Die SEC verlangt eine Kontaktadresse und sperrt anonyme Zugriffe. Eine
    // fremde Adresse einzutragen waere eine Falschangabe gegenueber einer
    // Behoerde.
    const previous = process.env.SEC_CONTACT_EMAIL;
    delete process.env.SEC_CONTACT_EMAIL;

    expect(secUserAgent()).toContain("contact-not-configured");

    process.env.SEC_CONTACT_EMAIL = "team@example.com";
    expect(secUserAgent()).toBe("StockPilotAI/0.1 team@example.com");

    if (previous === undefined) delete process.env.SEC_CONTACT_EMAIL;
    else process.env.SEC_CONTACT_EMAIL = previous;
  });
});
