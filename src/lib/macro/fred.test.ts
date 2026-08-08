import { describe, expect, it } from "vitest";
import {
  fredCitation,
  fredSeriesCatalog,
  fredSeriesUrl,
  parseFredCsv,
  toMonthlyChange
} from "@/lib/macro/fred";

/**
 * FRED füllt die Lücken, die der Kursanbieter mit HTTP 402 offengelassen hat:
 * WTI, Dollar-Index, 10-Jahres-Rendite und die US-Makroreihen.
 *
 * Die Tests prüfen zwei Dinge, die hier wichtiger sind als die Formeln: dass
 * fehlende Beobachtungen **verworfen und nicht gefüllt** werden, und dass die
 * Lizenzangabe je Reihe mitläuft statt pauschal angenommen zu werden.
 */

describe("CSV-Auswertung", () => {
  const csv = ["observation_date,UNRATE", "2026-05-01,4.0", "2026-06-01,4.2", "2026-07-01,4.1"].join("\n");

  it("liest Zeitpunkt und Wert", () => {
    expect(parseFredCsv(csv)).toEqual([
      { period: "2026-05-01", value: 4 },
      { period: "2026-06-01", value: 4.2 },
      { period: "2026-07-01", value: 4.1 }
    ]);
  });

  it("verwirft leere Beobachtungen, statt sie zu füllen", () => {
    // FRED laesst Zeilen ohne Beobachtung leer -- am 2026-08-08 in UMCSENT
    // direkt hinter dem ersten Wert gesehen. Eine interpolierte Zwischenzahl
    // waere genau die Erfindung, die dieses Projekt aus dem Code entfernt hat.
    const withGaps = ["observation_date,UMCSENT", "1952-11-01,86.2", "1952-12-01,", "1953-01-01,90.7"].join("\n");

    expect(parseFredCsv(withGaps)).toEqual([
      { period: "1952-11-01", value: 86.2 },
      { period: "1953-01-01", value: 90.7 }
    ]);
  });

  it("erkennt den Punkt als Platzhalter, nicht als Zahl", () => {
    const withDot = ["observation_date,DGS10", "2026-08-05,4.70", "2026-08-06,."].join("\n");

    expect(parseFredCsv(withDot)).toHaveLength(1);
  });

  it("verträgt leere und fehlerhafte Antworten", () => {
    expect(parseFredCsv("")).toEqual([]);
    expect(parseFredCsv("observation_date,UNRATE")).toEqual([]);
    expect(parseFredCsv("kaputt")).toEqual([]);
    expect(parseFredCsv("observation_date,X\n2026-01-01,keine Zahl")).toEqual([]);
  });
});

describe("Bestand in Veränderung", () => {
  it("bildet die monatliche Veränderung", () => {
    // FRED liefert mit PAYEMS den Bestand in Tausend. Die als NFP berichtete
    // Zahl ist die Veraenderung -- 158.858 minus 158.700 sind 158.000 neue
    // Stellen, nicht 158,9 Millionen.
    const stock = [
      { period: "2026-05-01", value: 158_600 },
      { period: "2026-06-01", value: 158_700 },
      { period: "2026-07-01", value: 158_858 }
    ];

    expect(toMonthlyChange(stock)).toEqual([
      { period: "2026-06-01", value: 100 },
      { period: "2026-07-01", value: 158 }
    ]);
  });

  it("lässt die erste Beobachtung weg", () => {
    // Sie hat keinen Vorgaenger. Eine Veraenderung gegenueber nichts gibt es
    // nicht -- eine 0 dort waere eine Aussage.
    expect(toMonthlyChange([{ period: "2026-01-01", value: 100 }])).toEqual([]);
    expect(toMonthlyChange([])).toEqual([]);
  });
});

describe("Katalog und Lizenz", () => {
  it("enthält keine Reihe, die Vorabgenehmigung braucht", () => {
    // Der Kern: `preapproval_required` heisst nur nicht-kommerziell ohne
    // schriftliche Erlaubnis. Solche Reihen gehoeren nicht in ein
    // kostenpflichtiges Produkt.
    for (const series of fredSeriesCatalog) {
      expect(["public_domain", "citation_required"]).toContain(series.copyright);
    }
  });

  it("nennt für jede Reihe die Ursprungsbehörde", () => {
    // Ohne sie ist die von FRED verlangte Quellenangabe nicht bildbar.
    for (const series of fredSeriesCatalog) {
      expect(series.originalSource.length).toBeGreaterThan(3);
      expect(fredCitation(series)).toContain(series.originalSource);
      expect(fredCitation(series)).toContain("FRED");
    }
  });

  it("kennzeichnet die einzige geschützte Reihe als solche", () => {
    // Am 2026-08-08 auf der Reihenseite abgelesen: Michigan ist
    // "Copyrighted: Citation required", alle uebrigen sind Public Domain.
    const protectedSeries = fredSeriesCatalog.filter((series) => series.copyright === "citation_required");

    expect(protectedSeries.map((series) => series.seriesId)).toEqual(["UMCSENT"]);
  });

  it("führt keine Reihe doppelt", () => {
    const ids = fredSeriesCatalog.map((series) => series.seriesId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("meldet nur die Beschäftigung als Veränderung", () => {
    const asChange = fredSeriesCatalog.filter((series) => series.reportAsChange);
    expect(asChange.map((series) => series.seriesId)).toEqual(["PAYEMS"]);
  });

  it("deckt die von §28 verlangten US-Größen ab", () => {
    const ids = fredSeriesCatalog.map((series) => series.seriesId);

    // WTI, Dollar-Index und die 10J-Rendite waren beim Kursanbieter mit
    // HTTP 402 gesperrt. Sie sind der eigentliche Gewinn dieser Quelle.
    expect(ids).toContain("DCOILWTICO");
    expect(ids).toContain("DTWEXBGS");
    expect(ids).toContain("DGS10");
    expect(ids).toContain("CPIAUCSL");
    expect(ids).toContain("PAYEMS");
  });

  it("baut eine HTTPS-URL auf dem freigegebenen Host", () => {
    const url = fredSeriesUrl(fredSeriesCatalog[0]);

    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("fred.stlouisfed.org");
    expect(url.searchParams.get("id")).toBe(fredSeriesCatalog[0].seriesId);
  });
});
