import { describe, expect, it } from "vitest";
import {
  buildFearGreedReading,
  buildNewsSentimentReading,
  buildSentimentOverview,
  buildVolatilityReading,
  deriveConfidence,
  parseFearGreed
} from "@/lib/analysis/sentiment";

/**
 * §30 zählt Quellen auf und stellt dann eine Bedingung, die schwerer wiegt als
 * die Liste:
 *
 * > Immer mit: Quelle, Zeitraum, Datenmenge, Konfidenz
 *
 * Die Tests prüfen deshalb vor allem, dass diese vier Angaben nie fehlen — und
 * dass die Werte **nicht** zu einer Zahl verrechnet werden.
 */

const now = new Date("2026-08-09T12:00:00.000Z");

function news(count: number, sentiment: "positive" | "neutral" | "negative", daysAgo = 0) {
  return Array.from({ length: count }, () => ({
    sentiment,
    publishedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  }));
}

describe("die vier Pflichtangaben", () => {
  it("liefert sie bei jeder Quelle", () => {
    const readings = [
      buildNewsSentimentReading(news(40, "positive"), now),
      buildFearGreedReading(parseFearGreed({ data: [{ value: "31", value_classification: "Fear", timestamp: "1786233600" }] }), now),
      buildVolatilityReading([{ period: "2026-08-08", value: 15.1 }], now)
    ];

    for (const reading of readings) {
      expect(reading).not.toBeNull();
      expect(reading!.source.length).toBeGreaterThan(5);
      expect(reading!.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(reading!.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(reading!.sampleSize).toBeGreaterThan(0);
      expect(["hoch", "mittel", "niedrig"]).toContain(reading!.confidence);
      // Die Stufe allein waere eine Behauptung.
      expect(reading!.confidenceReason.length).toBeGreaterThan(10);
      expect(reading!.caveat.length).toBeGreaterThan(30);
    }
  });
});

describe("Konfidenz", () => {
  it("sinkt mit der Datenmenge", () => {
    // "Sentiment 72" aus drei Meldungen und aus dreihundert sind zwei voellig
    // verschiedene Aussagen -- und sehen identisch aus.
    expect(deriveConfidence(3, 0).level).toBe("niedrig");
    expect(deriveConfidence(20, 0).level).toBe("mittel");
    expect(deriveConfidence(60, 0).level).toBe("hoch");
  });

  it("sinkt mit dem Alter", () => {
    expect(deriveConfidence(100, 0).level).toBe("hoch");
    expect(deriveConfidence(100, 4).level).toBe("mittel");
    expect(deriveConfidence(100, 20).level).toBe("niedrig");
  });

  it("nennt den Grund", () => {
    expect(deriveConfidence(3, 0).reason).toContain("Ausreißer");
    expect(deriveConfidence(100, 20).reason).toContain("nicht die heutige Stimmung");
    expect(deriveConfidence(0, 0).reason).toContain("Keine Beobachtungen");
  });
});

describe("Nachrichtenstimmung", () => {
  it("bildet den Durchschnitt der Einstufungen", () => {
    expect(buildNewsSentimentReading(news(10, "positive"), now)?.value).toBe(100);
    expect(buildNewsSentimentReading(news(10, "negative"), now)?.value).toBe(0);
    expect(buildNewsSentimentReading(news(10, "neutral"), now)?.value).toBe(50);
  });

  it("nennt die Zahl der Meldungen", () => {
    const reading = buildNewsSentimentReading(news(37, "positive"), now);

    expect(reading?.sampleSize).toBe(37);
    expect(reading?.confidence).toBe("hoch");
  });

  it("stuft dieselbe Zahl aus wenigen Meldungen niedriger ein", () => {
    const wenige = buildNewsSentimentReading(news(3, "positive"), now);
    const viele = buildNewsSentimentReading(news(300, "positive"), now);

    expect(wenige?.value).toBe(viele?.value);
    expect(wenige?.confidence).toBe("niedrig");
    expect(viele?.confidence).toBe("hoch");
  });

  it("warnt davor, gute Nachrichten für ein Signal zu halten", () => {
    expect(buildNewsSentimentReading(news(10, "positive"), now)?.caveat).toContain("bereits im Kurs");
  });

  it("liefert ohne Meldungen nichts", () => {
    expect(buildNewsSentimentReading([], now)).toBeNull();
  });
});

describe("Angst und Gier", () => {
  it("liest Werte, die als Zeichenkette kommen", () => {
    // Der Anbieter liefert `value: "31"`, nicht `31`. Wer das uebersieht,
    // vergleicht Zeichenketten der Laenge nach.
    const points = parseFearGreed({
      data: [{ value: "31", value_classification: "Fear", timestamp: "1786233600" }]
    });

    expect(points[0].value).toBe(31);
    expect(typeof points[0].value).toBe("number");
  });

  it("übersetzt die Einstufung", () => {
    const reading = buildFearGreedReading(
      parseFearGreed({ data: [{ value: "31", value_classification: "Fear", timestamp: "1786233600" }] }),
      now
    );

    expect(reading?.classification).toBe("Angst");
  });

  it("verträgt fremde Antworten", () => {
    expect(parseFearGreed(null)).toEqual([]);
    expect(parseFearGreed({ data: "kaputt" })).toEqual([]);
    expect(parseFearGreed({ data: [{ value: "keine Zahl" }] })).toEqual([]);
  });

  it("nennt den Zeitraum aus dem ältesten und jüngsten Punkt", () => {
    const reading = buildFearGreedReading(
      parseFearGreed({
        data: [
          { value: "31", value_classification: "Fear", timestamp: "1786233600" },
          { value: "45", value_classification: "Fear", timestamp: "1783641600" }
        ]
      }),
      now
    );

    expect(reading?.sampleSize).toBe(2);
    expect(reading!.period.from < reading!.period.to).toBe(true);
  });
});

describe("Volatilität", () => {
  it("dreht die Skala um", () => {
    // Hoher VIX heisst Nervositaet, also schlechte Stimmung. Ohne Umkehrung
    // stuende ein Angstwert neben zwei Gierwerten auf derselben Skala.
    const ruhig = buildVolatilityReading([{ period: "2026-08-08", value: 12 }], now);
    const nervoes = buildVolatilityReading([{ period: "2026-08-08", value: 35 }], now);

    expect(ruhig!.value!).toBeGreaterThan(nervoes!.value!);
    expect(ruhig?.classification).toBe("Ruhig");
    expect(nervoes?.classification).toBe("Sehr nervös");
  });

  it("nennt den Rohwert im Vorbehalt", () => {
    // Der umgerechnete Wert allein waere nicht nachpruefbar.
    expect(buildVolatilityReading([{ period: "2026-08-08", value: 15.1 }], now)?.caveat).toContain("15.1");
  });

  it("warnt, dass Volatilität keine Richtung ist", () => {
    expect(buildVolatilityReading([{ period: "2026-08-08", value: 15 }], now)?.caveat).toContain("nicht die Richtung");
  });
});

describe("Übersicht", () => {
  it("verrechnet die Werte nicht zu einer Zahl", () => {
    // Ein Mittelwert aus Nachrichtenstimmung, Krypto-Index und Volatilitaet
    // waere eine Zahl ohne Gegenstand.
    const overview = buildSentimentOverview([
      buildNewsSentimentReading(news(40, "positive"), now),
      buildVolatilityReading([{ period: "2026-08-08", value: 15 }], now)
    ]);

    expect(overview).not.toHaveProperty("overall");
    expect(overview).not.toHaveProperty("score");
    expect(overview.readings).toHaveLength(2);
    expect(overview.note).toContain("nicht zu einem Gesamtsentiment");
  });

  it("nennt namentlich, was §30 verlangt und nicht geht", () => {
    const overview = buildSentimentOverview([]);

    expect(overview.unavailable.join(" ")).toContain("Put/Call");
    expect(overview.unavailable.join(" ")).toContain("Reddit");
    expect(overview.unavailable.join(" ")).toContain("CNN");
  });

  it("lässt fehlende Quellen einfach weg", () => {
    expect(buildSentimentOverview([null, null]).readings).toEqual([]);
  });
});
