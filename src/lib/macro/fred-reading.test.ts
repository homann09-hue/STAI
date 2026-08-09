import { describe, expect, it } from "vitest";
import { buildMacroReading, buildMacroOverview } from "@/lib/macro/analysis";
import { derivationCaveat, licenceCaveat, toMacroReadingSource } from "@/lib/macro/fred-reading";
import { fredSeriesCatalog, findFredSeries, type FredSeriesDefinition } from "@/lib/macro/fred";

/**
 * `fred.ts` war vollständig gebaut und von keiner Zeile importiert. Diese Datei
 * prüft das Stück, das gefehlt hat — und vor allem die Stellen, an denen die
 * Übersetzung eine Zahl still verfälschen könnte.
 */

const now = new Date("2026-08-09T12:00:00.000Z");

function series(id: string): FredSeriesDefinition {
  const found = findFredSeries(id);
  if (!found) throw new Error(`Reihe ${id} fehlt im Katalog`);
  return found;
}

describe("Übersetzung in die gemeinsame Auswertung", () => {
  it("nennt die Ursprungsbehörde, nicht FRED", () => {
    // Der Verbraucherpreisindex stammt vom US-Arbeitsministerium. "Quelle: FRED"
    // waere bequem und falsch -- und FRED verlangt die Angabe ausdruecklich.
    const source = toMacroReadingSource(series("us_cpi"));

    expect(source.source).toContain("U.S. Bureau of Labor Statistics");
    expect(source.source).toContain("FRED");
    // Kein doppeltes "Quelle: Quelle:" in der Anzeige.
    expect(source.source.startsWith("Quelle:")).toBe(false);
  });

  it("verlinkt die Reihenseite, auf der der Lizenzstand steht", () => {
    expect(toMacroReadingSource(series("us_cpi")).sourceUrl).toBe(
      "https://fred.stlouisfed.org/series/CPIAUCSL"
    );
  });

  it("führt Tagesreihen als Handelstagsreihen", () => {
    // FRED nennt sie "daily", liefert aber nur Handelstage. Als echte Tagesreihe
    // gefuehrt waere eine Rendite vom Freitag am Montag "verspaetet" -- obwohl
    // sie die juengste ist, die es gibt.
    expect(toMacroReadingSource(series("us_yield_10y")).frequency).toBe("business_daily");
    expect(toMacroReadingSource(series("us_cpi")).frequency).toBe("monthly");
    expect(toMacroReadingSource(series("us_gdp_growth")).frequency).toBe("quarterly");
  });

  it("reicht die Einheit unverändert durch", () => {
    expect(toMacroReadingSource(series("us_retail_sales")).unit).toBe("usd");
    expect(toMacroReadingSource(series("us_nonfarm_payrolls")).unit).toBe("thousands");
  });
});

describe("Zusätze, ohne die der Wert falsch wäre", () => {
  it("hängt an die Einzelhandelsumsätze die Größenordnung", () => {
    // RSAFS kommt in **Millionen** Dollar. "700.000,00 $" waere um den Faktor
    // eine Million daneben -- und saehe voellig plausibel aus.
    expect(toMacroReadingSource(series("us_retail_sales")).valueSuffix).toBe("Mio. $");
  });

  it("lässt Prozent- und Indexreihen ohne Zusatz", () => {
    expect(toMacroReadingSource(series("us_unemployment")).valueSuffix).toBeNull();
    expect(toMacroReadingSource(series("us_cpi")).valueSuffix).toBeNull();
  });

  it("kennzeichnet die Beschäftigung als abgeleitet", () => {
    // Die Quelle meldet den Bestand, angezeigt wird die Veraenderung. Die Zahl,
    // die der Nutzer sieht, steht so bei FRED nicht.
    expect(derivationCaveat(series("us_nonfarm_payrolls"))).toContain("Abgeleitet");
    expect(derivationCaveat(series("us_cpi"))).toBeNull();
  });

  it("weist die einzige geschützte Reihe als geschützt aus", () => {
    expect(licenceCaveat(series("us_consumer_sentiment"))).toContain("Universität".slice(0, 4));
    expect(licenceCaveat(series("us_consumer_sentiment"))).toContain("Quellenangabe");
    expect(licenceCaveat(series("us_cpi"))).toBeNull();
  });

  it("führt keine Reihe, die eine schriftliche Erlaubnis bräuchte", () => {
    // `preapproval_required` erlaubt nur nicht-kommerzielle Nutzung. In einem
    // kostenpflichtigen Produkt waere das ein Lizenzbruch, kein Schoenheitsfehler.
    for (const entry of fredSeriesCatalog) {
      expect(["public_domain", "citation_required"]).toContain(entry.copyright);
      expect(entry.originalSource.length).toBeGreaterThan(5);
    }
  });
});

describe("Auswertung mit übersetzten Reihen", () => {
  it("liest den Ölpreis mit Zusatz und ohne Prozentzeichen", () => {
    const reading = buildMacroReading(
      toMacroReadingSource(series("wti_oil")),
      [
        { period: "2026-08-05", value: 63.5 },
        { period: "2026-08-06", value: 64.2 }
      ],
      now
    );

    expect(reading?.unit).toBe("usd");
    expect(reading?.valueSuffix).toBe("$ je Barrel");
    expect(reading?.trend).toBe("rising");
  });

  it("hält kleine Bewegungen großer Zahlen für flach", () => {
    // Die Einzelhandelsumsaetze stehen bei rund 700 000 (Millionen Dollar). Mit
    // der festen Indexschwelle von 0,5 waere jede Rundung ein "Trend" gewesen.
    const reading = buildMacroReading(
      toMacroReadingSource(series("us_retail_sales")),
      [
        { period: "2026-05-01", value: 704_000 },
        { period: "2026-06-01", value: 704_300 }
      ],
      now
    );

    expect(reading?.trend).toBe("flat");
  });

  it("erkennt eine echte Bewegung derselben Reihe", () => {
    const reading = buildMacroReading(
      toMacroReadingSource(series("us_retail_sales")),
      [
        { period: "2026-05-01", value: 704_000 },
        { period: "2026-06-01", value: 718_000 }
      ],
      now
    );

    expect(reading?.trend).toBe("rising");
  });
});

describe("US-Zinsstruktur", () => {
  function yieldReading(id: string, period: string, value: number) {
    const reading = buildMacroReading(toMacroReadingSource(series(id)), [{ period, value }], now);
    if (!reading) throw new Error(`${id} lieferte keinen Wert`);
    return reading;
  }

  const usShape = {
    shortEndId: "us_yield_3m",
    longEndId: "us_yield_10y",
    disclaimer: "Testhinweis."
  };

  it("bildet die Kurve aus den US-Kennungen", () => {
    // Echte Werte vom 2026-08-06: 3M bei 3,90 %, 10J bei rund 4,35 %.
    const overview = buildMacroOverview(
      [yieldReading("us_yield_3m", "2026-08-06", 3.9), yieldReading("us_yield_10y", "2026-08-06", 4.35)],
      [],
      null,
      usShape
    );

    expect(overview.yieldCurve.available).toBe(true);
    expect(overview.yieldCurve.shape).toBe("normal");
    expect(overview.yieldCurve.spread).toBeCloseTo(0.45, 2);
  });

  it("sucht nicht nach den Kennungen des Euroraums", () => {
    // Ohne die Formparameter haette `buildMacroOverview` nach `ea_yield_3m`
    // gesucht, nichts gefunden und die Kurve stumm leer gelassen -- bei
    // vollstaendig vorhandenen Daten.
    const readings = [
      yieldReading("us_yield_3m", "2026-08-06", 3.9),
      yieldReading("us_yield_10y", "2026-08-06", 4.35)
    ];

    expect(buildMacroOverview(readings, [], null).yieldCurve.available).toBe(false);
    expect(buildMacroOverview(readings, [], null, usShape).yieldCurve.available).toBe(true);
  });

  it("trägt den US-Haftungshinweis statt des EZB-Hinweises", () => {
    const overview = buildMacroOverview([], [], null, usShape);

    expect(overview.disclaimer).toBe("Testhinweis.");
    expect(buildMacroOverview([], []).disclaimer).toContain("EZB");
  });
});
