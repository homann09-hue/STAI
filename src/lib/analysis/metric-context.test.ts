import { describe, expect, it } from "vitest";
import {
  bandTone,
  buildMetricContext,
  formatMetric,
  metricDefinitions
} from "@/lib/analysis/metric-context";

/**
 * §50 nennt sein Ziel als Beispiel:
 *
 * > Nicht nur: `P/E 42`
 * > sondern: `P/E 42 – deutlich über dem 5-Jahres-Median.`
 *
 * Die Tests prüfen deshalb den Satz selbst — und die Fälle, in denen **kein**
 * Satz gebildet werden darf.
 */

// Am 2026-08-08 vom Anbieter gemessen, AAPL, Geschaeftsjahre 2021 bis 2025.
const applePe = [34.11, 37.28, 27.79, 24.46, 25.91];

describe("der Satz aus §50", () => {
  it("setzt das KGV in den Fünfjahresvergleich", () => {
    const result = buildMetricContext("peRatio", 34.11, applePe);

    // Median 27,79 -- 34,11 liegt 22,7 % darueber.
    expect(result?.median).toBeCloseTo(27.79, 2);
    expect(result?.deviationPercent).toBeCloseTo(22.7, 1);
    expect(result?.band).toBe("far_above");
    expect(result?.sentence).toBe("KGV 34,1 — deutlich über dem 5-Jahres-Median von 27,8.");
  });

  it("unterscheidet deutlich von leicht", () => {
    // 8 bis 20 % ist "ueber", darueber "deutlich ueber".
    expect(buildMetricContext("peRatio", 31, applePe)?.band).toBe("above");
    expect(buildMetricContext("peRatio", 31, applePe)?.sentence).toContain("über dem");
    expect(buildMetricContext("peRatio", 31, applePe)?.sentence).not.toContain("deutlich");
    expect(buildMetricContext("peRatio", 40, applePe)?.sentence).toContain("deutlich über");
  });

  it("nennt eine geringe Abweichung den üblichen Rahmen", () => {
    const result = buildMetricContext("peRatio", 28, applePe);

    expect(result?.band).toBe("typical");
    expect(result?.sentence).toContain("im üblichen Rahmen");
  });

  it("beschreibt auch die Gegenrichtung", () => {
    expect(buildMetricContext("peRatio", 18, applePe)?.sentence).toContain("deutlich unter");
    expect(buildMetricContext("peRatio", 24.5, applePe)?.sentence).toContain("unter dem");
  });

  it("nennt das Zeitfenster mit, statt es anzunehmen", () => {
    // Der Tarif liefert genau fuenf Jahre. Bei weniger muss der Satz das sagen.
    expect(buildMetricContext("peRatio", 34, applePe)?.sentence).toContain("5-Jahres-Median");
    expect(buildMetricContext("peRatio", 34, applePe.slice(0, 3))?.sentence).toContain("3-Jahres-Median");
  });
});

describe("wann kein Vergleich gebildet wird", () => {
  it("bildet aus zwei Jahren keinen Median", () => {
    // Zwei Werte ergeben deren Mittelwert -- das beschreibt keine Historie.
    const result = buildMetricContext("peRatio", 34, [30, 26]);

    expect(result?.median).toBeNull();
    expect(result?.band).toBe("unknown");
    expect(result?.sentence).toContain("zu wenig für eine historische Einordnung");
  });

  it("behandelt eine Reihe aus lauter Nullen als Lücke", () => {
    // Bei AAPL trifft das am 2026-08-08 auf die Eigenkapitalrendite zu: alle
    // fuenf Jahre stehen auf 0,00. Das ist ein leeres Anbieterfeld, keine
    // Messung -- eine Rendite von 0 % waere eine Aussage.
    const result = buildMetricContext("returnOnEquity", 0.27, [0, 0, 0, 0, 0]);

    expect(result?.median).toBeNull();
    expect(result?.years).toBe(0);
    expect(result?.sentence).toContain("keine Vergangenheitswerte");
  });

  it("sagt bei fehlendem aktuellen Wert nichts über die Historie", () => {
    const result = buildMetricContext("peRatio", null, applePe);

    expect(result?.value).toBeNull();
    expect(result?.band).toBe("unknown");
    expect(result?.sentence).toBe("KGV liegt nicht vor.");
  });

  it("verträgt Lücken in der Reihe", () => {
    const result = buildMetricContext("peRatio", 34.11, [34.11, null, 27.79, undefined, 25.91]);

    expect(result?.years).toBe(3);
    expect(result?.sentence).toContain("3-Jahres-Median");
  });

  it("kennt eine unbekannte Kennzahl nicht", () => {
    expect(buildMetricContext("gibtEsNicht", 5, [1, 2, 3])).toBeNull();
  });
});

describe("Messung und Bewertung getrennt", () => {
  it("packt keine Wertung in den Satz", () => {
    // "Ueber dem Median" ist eine Messung. Ob das gut ist, haengt von der
    // Kennzahl ab und gehoert nicht in denselben Satz.
    const expensive = buildMetricContext("peRatio", 40, applePe);

    expect(expensive?.sentence).not.toMatch(/teuer|günstig|gut|schlecht|Kauf/i);
  });

  it("dreht die Bewertung je nach Kennzahl um", () => {
    const highPe = buildMetricContext("peRatio", 40, applePe)!;
    const highMargin = buildMetricContext("grossMargin", 0.6, [0.47, 0.46, 0.44, 0.43, 0.42])!;

    // Beide liegen ueber dem Median -- das eine ist unguenstig, das andere nicht.
    expect(highPe.band).toBe("far_above");
    expect(highMargin.band).toBe("far_above");
    expect(bandTone(highPe)).toBe("unfavourable");
    expect(bandTone(highMargin)).toBe("favourable");
  });

  it("bewertet richtungslose Kennzahlen nicht", () => {
    // Ein hoher RSI ist weder gut noch schlecht.
    const rsi = buildMetricContext("rsi", 78, [50, 52, 48, 55, 51])!;

    expect(rsi.band).toBe("far_above");
    expect(bandTone(rsi)).toBe("neutral");
  });
});

describe("Erklärungen", () => {
  it("gibt jeder Kennzahl Erklärung, Begründung und Vorbehalt", () => {
    // §50 verlangt Tooltip, kurze Erklaerung und Kontext. Ein Feld ohne
    // Vorbehalt waere der Punkt, an dem eine Kennzahl mehr zu sagen scheint,
    // als sie kann.
    for (const definition of Object.values(metricDefinitions)) {
      expect(definition.explanation.length).toBeGreaterThan(30);
      expect(definition.whyItMatters.length).toBeGreaterThan(20);
      expect(definition.caveat.length).toBeGreaterThan(20);
    }
  });

  it("warnt beim ADX vor dem häufigsten Lesefehler", () => {
    expect(metricDefinitions.adx.caveat).toContain("nichts");
    expect(metricDefinitions.adx.direction).toBe("neutral");
  });

  it("nennt beim KGV, dass hoch nicht teuer heißt", () => {
    expect(metricDefinitions.peRatio.caveat).toContain("Wachstum erwartet");
  });
});

describe("Formatierung", () => {
  it("formatiert nach Art der Kennzahl", () => {
    expect(formatMetric(0.274, "percent")).toBe("27,4 %");
    expect(formatMetric(34.11, "ratio")).toBe("34,1");
    expect(formatMetric(313.33, "currency", "$")).toBe("313,33 $");
  });

  it("macht aus einer Lücke keinen Wert", () => {
    expect(formatMetric(null, "ratio")).toBe("—");
    expect(formatMetric(Number.NaN, "percent")).toBe("—");
  });
});
