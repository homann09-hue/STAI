import { describe, expect, it } from "vitest";
import { assessYieldCurve, buildMacroOverview, buildMacroReading } from "@/lib/macro/analysis";
import { parseSdmxCsv, periodToDate, splitCsvRow } from "@/lib/macro/sdmx";
import { findMacroSeries, macroSeriesCatalog, macroSeriesUrl } from "@/lib/macro/series";

/**
 * Die Testdaten sind gekuerzte, aber echte Antworten der EZB-API vom
 * 2026-08-08. Erfundene Beispielantworten wuerden genau das nicht pruefen,
 * worauf es ankommt: dass der Parser das reale Format vertraegt.
 */

const REAL_YIELD_CSV = `KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,PROVIDER_FM_ID,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,U2,EUR,4F,G_N_A,SV_C_YM,SR_10Y,2026-05-19,3.2197250915
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,U2,EUR,4F,G_N_A,SV_C_YM,SR_10Y,2026-05-20,3.1913866523`;

const REAL_HICP_CSV = `KEY,FREQ,REF_AREA,ADJUSTMENT,ICP_ITEM,STS_INSTITUTION,ICP_SUFFIX,TIME_PERIOD,OBS_VALUE
ICP.M.U2.N.000000.4.ANR,M,U2,N,000000,4,ANR,2025-11,2.1
ICP.M.U2.N.000000.4.ANR,M,U2,N,000000,4,ANR,2025-12,1.9`;

/** Die Langform der EZB-Antwort enthaelt Beschreibungstexte mit Kommas. */
const QUOTED_CSV = `KEY,TIME_PERIOD,OBS_VALUE,TITLE_COMPL
EXR.D.USD.EUR.SP00.A,2026-06-18,1.1461,"ECB reference exchange rate, US dollar/Euro, 2.15 pm (C.E.T.)"`;

const series = (id: string) => {
  const definition = findMacroSeries(id);
  if (!definition) throw new Error(`Testreihe ${id} fehlt im Katalog`);
  return definition;
};

describe("splitCsvRow", () => {
  it("verschiebt keine Spalten, wenn ein Text ein Komma enthält", () => {
    // Ohne Beachtung der Anfuehrungszeichen landet hier ein Textfragment im
    // Wertefeld -- der Kurs waere dann keine Zahl mehr.
    const parsed = parseSdmxCsv(QUOTED_CSV);
    expect(parsed.observations).toEqual([{ period: "2026-06-18", value: 1.1461 }]);
  });

  it("liest doppelte Anführungszeichen als Zeichen, nicht als Feldende", () => {
    expect(splitCsvRow('a,"b""c",d')).toEqual(["a", 'b"c', "d"]);
  });
});

describe("parseSdmxCsv", () => {
  it("liest eine echte EZB-Antwort", () => {
    const parsed = parseSdmxCsv(REAL_YIELD_CSV);
    expect(parsed.observations).toHaveLength(2);
    expect(parsed.observations[1]).toEqual({ period: "2026-05-20", value: 3.1913866523 });
    expect(parsed.rejectedRows).toBe(0);
  });

  it("findet die Spalten über die Kopfzeile, nicht über ihre Position", () => {
    // Die EZB liefert je nach detail-Parameter unterschiedlich viele Spalten.
    const reordered = `OBS_VALUE,TIME_PERIOD\n1.5,2026-01-02`;
    expect(parseSdmxCsv(reordered).observations).toEqual([{ period: "2026-01-02", value: 1.5 }]);
  });

  it("verwirft unlesbare Zeilen, statt sie zu raten", () => {
    const broken = `TIME_PERIOD,OBS_VALUE\n2026-01-02,\n2026-01-03,k.A.\nnicht-ein-datum,1.2\n2026-01-06,2.5`;
    const parsed = parseSdmxCsv(broken);

    expect(parsed.observations).toEqual([{ period: "2026-01-06", value: 2.5 }]);
    expect(parsed.rejectedRows).toBe(3);
  });

  it("meldet ein falsches Format als Fehler statt als leeres Ergebnis", () => {
    // Ein leeres Ergebnis waere hier eine Luege: es gab Daten, sie waren nur
    // nicht das, was wir erwartet haben.
    expect(() => parseSdmxCsv("<html><body>Fehler</body></html>\nzweite Zeile")).toThrow(/Zeitreihenspalten/);
  });

  it("sortiert aufsteigend, damit der letzte Eintrag wirklich der jüngste ist", () => {
    const unsorted = `TIME_PERIOD,OBS_VALUE\n2026-03-01,3\n2026-01-01,1\n2026-02-01,2`;
    expect(parseSdmxCsv(unsorted).observations.map((row) => row.value)).toEqual([1, 2, 3]);
  });
});

describe("periodToDate", () => {
  it("legt einen Monatswert auf das Monatsende", () => {
    // Der HVPI fuer Dezember ist am 1. Dezember noch nicht bekannt. Ein
    // Monatsanfang wuerde die Daten juenger aussehen lassen, als sie sind.
    expect(periodToDate("2025-12")?.toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(periodToDate("2026-02")?.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("erkennt Tages- und Quartalswerte", () => {
    expect(periodToDate("2026-05-20")?.toISOString().slice(0, 10)).toBe("2026-05-20");
    expect(periodToDate("2026-Q1")?.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("gibt bei unbekanntem Format nichts zurück", () => {
    expect(periodToDate("irgendwann")).toBeNull();
  });
});

describe("buildMacroReading", () => {
  const now = new Date("2026-08-08T00:00:00.000Z");

  it("rechnet Veränderung und Datenalter aus einer echten Antwort", () => {
    const reading = buildMacroReading(series("ea_yield_10y"), parseSdmxCsv(REAL_YIELD_CSV).observations, now);

    expect(reading).not.toBeNull();
    expect(reading?.value).toBeCloseTo(3.1914, 4);
    expect(reading?.asOf).toBe("2026-05-20");
    expect(reading?.change).toBeCloseTo(-0.0283, 4);
    // Die Veraenderung wird ausgewiesen, aber nicht zum Trend erklaert: 2,8
    // Basispunkte an einem Tag liegen unter der Rauschschwelle. Genau dafuer
    // gibt es sie -- sonst waere jede Rundungsdifferenz eine Richtung.
    expect(reading?.trend).toBe("flat");
    expect(reading?.ageDays).toBe(80);
  });

  it("kennzeichnet einen 80 Tage alten Tageswert als veraltet", () => {
    const reading = buildMacroReading(series("ea_yield_10y"), parseSdmxCsv(REAL_YIELD_CSV).observations, now);

    expect(reading?.freshness).toBe("outdated");
    expect(reading?.caveats.join(" ")).toMatch(/nicht die heutige Lage/);
  });

  it("misst eine Monatsreihe an ihrer eigenen Frequenz", () => {
    // Dieselbe Anzahl Tage bedeutet bei einer Monatsreihe etwas anderes als
    // bei einer Tagesreihe.
    const decemberPlus40 = new Date("2026-02-09T00:00:00.000Z");
    const reading = buildMacroReading(series("ea_inflation_hicp"), parseSdmxCsv(REAL_HICP_CSV).observations, decemberPlus40);

    expect(reading?.ageDays).toBe(40);
    expect(reading?.freshness).toBe("current");
    expect(reading?.change).toBeCloseTo(-0.2, 5);
  });

  it("leitet aus einer einzigen Beobachtung keine Veränderung ab", () => {
    const reading = buildMacroReading(series("ea_policy_rate"), [{ period: "2026-06-09", value: 2.15 }], now);

    expect(reading?.change).toBeNull();
    expect(reading?.trend).toBe("unknown");
    expect(reading?.caveats.join(" ")).toMatch(/Nur eine Beobachtung/);
  });

  it("nennt eine Rundungsdifferenz nicht Trend", () => {
    const reading = buildMacroReading(
      series("ea_yield_10y"),
      [
        { period: "2026-08-06", value: 3.2 },
        { period: "2026-08-07", value: 3.21 }
      ],
      now
    );

    expect(reading?.trend).toBe("flat");
  });

  it("gibt ohne Beobachtung nichts zurück statt eines Platzhalters", () => {
    expect(buildMacroReading(series("ea_policy_rate"), [], now)).toBeNull();
  });
});

describe("assessYieldCurve", () => {
  const now = new Date("2026-08-08T00:00:00.000Z");

  function readingAt(id: string, period: string, value: number) {
    return buildMacroReading(series(id), [{ period, value }], now);
  }

  it("erkennt eine normale Kurve aus den gemessenen Renditen", () => {
    // 3M 2,159 und 10J 3,191 -- das sind die echten Werte vom Mai 2026.
    const curve = assessYieldCurve(
      readingAt("ea_yield_3m", "2026-05-19", 2.1587382744),
      readingAt("ea_yield_10y", "2026-05-20", 3.1913866523)
    );

    expect(curve.available).toBe(true);
    expect(curve.shape).toBe("normal");
    expect(curve.spread).toBeCloseTo(1.0326, 4);
    // Der aeltere Stichtag bestimmt, wie alt die Aussage ist.
    expect(curve.asOf).toBe("2026-05-19");
  });

  it("verweigert die Aussage bei zu weit auseinanderliegenden Stichtagen", () => {
    // Der Kern von §22: unterschiedliche Zeitstaende duerfen nicht unbemerkt
    // vermischt werden. Zwei Renditen aus verschiedenen Monaten ergeben keine
    // Zinskurve.
    const curve = assessYieldCurve(
      readingAt("ea_yield_3m", "2026-01-15", 2.0),
      readingAt("ea_yield_10y", "2026-05-20", 3.19)
    );

    expect(curve.available).toBe(false);
    expect(curve.spread).toBeNull();
    expect(curve.shape).toBe("unknown");
    expect(curve.interpretation).toMatch(/Scheingenauigkeit/);
  });

  it("erkennt eine inverse Kurve und stellt sie als Signal dar, nicht als Vorhersage", () => {
    const curve = assessYieldCurve(
      readingAt("ea_yield_3m", "2026-05-19", 3.6),
      readingAt("ea_yield_10y", "2026-05-20", 3.0)
    );

    expect(curve.shape).toBe("inverted");
    expect(curve.interpretation).toMatch(/Signal, keine Vorhersage/);
  });

  it("erklärt eine fehlende Rendite, statt stillzuschweigen", () => {
    const curve = assessYieldCurve(null, readingAt("ea_yield_10y", "2026-05-20", 3.19));

    expect(curve.available).toBe(false);
    expect(curve.caveats).toHaveLength(1);
  });

  it("weist auf nicht tagesaktuelle Grundlage hin", () => {
    const curve = assessYieldCurve(
      readingAt("ea_yield_3m", "2026-05-19", 2.16),
      readingAt("ea_yield_10y", "2026-05-20", 3.19)
    );

    expect(curve.caveats.join(" ")).toMatch(/nicht tagesaktuell/);
  });
});

describe("buildMacroOverview", () => {
  const now = new Date("2026-08-08T00:00:00.000Z");

  it("nennt eine einzelne Reihe kein Gesamtbild", () => {
    const reading = buildMacroReading(series("ea_policy_rate"), [{ period: "2026-08-07", value: 2.15 }], now);
    const overview = buildMacroOverview(reading ? [reading] : [], ["ea_inflation_hicp"]);

    expect(overview.reportable).toBe(false);
    expect(overview.unavailableSeries).toEqual(["ea_inflation_hicp"]);
  });

  it("trägt den Hinweis auf den Stichtag immer mit", () => {
    const overview = buildMacroOverview([], []);
    expect(overview.disclaimer).toMatch(/nicht den heutigen Tag/);
    expect(overview.disclaimer).toMatch(/Keine Anlageberatung/);
  });
});

describe("macroSeriesCatalog", () => {
  it("nennt für jede Reihe Quelle, Erklärung und Frequenz", () => {
    for (const definition of macroSeriesCatalog) {
      expect(definition.explanation.length).toBeGreaterThan(30);
      expect(definition.sourceUrl).toMatch(/^https:\/\//);
      expect(definition.source).toBe("ECB Data Portal");
    }
  });

  it("baut nur Abfragen gegen den freigegebenen EZB-Host", () => {
    for (const definition of macroSeriesCatalog) {
      const url = macroSeriesUrl(definition, 12);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("data-api.ecb.europa.eu");
      expect(url.searchParams.get("detail")).toBe("dataonly");
    }
  });

  it("begrenzt die Zahl abgefragter Beobachtungen", () => {
    expect(macroSeriesUrl(macroSeriesCatalog[0], 10_000).searchParams.get("lastNObservations")).toBe("240");
    expect(macroSeriesUrl(macroSeriesCatalog[0], 0).searchParams.get("lastNObservations")).toBe("1");
  });
});
