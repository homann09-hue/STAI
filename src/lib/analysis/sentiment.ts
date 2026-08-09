/**
 * Stimmungsindikatoren.
 *
 * §30 zählt mögliche Quellen auf und stellt dann eine Bedingung, die schwerer
 * wiegt als die Liste:
 *
 * > Immer mit: Quelle, Zeitraum, Datenmenge, Konfidenz
 *
 * **Dieses „immer" ist hier im Typ verankert.** `SentimentReading` verlangt alle
 * vier Felder; eine Stimmungszahl ohne sie lässt sich gar nicht erst bilden.
 * Genau darauf kommt es an: ein Stimmungswert ohne Datenmenge ist wertlos, denn
 * „Sentiment 72" aus drei Meldungen und aus dreihundert sind zwei völlig
 * verschiedene Aussagen — und sehen identisch aus.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

export type SentimentConfidence = "hoch" | "mittel" | "niedrig";

export type SentimentReading = {
  id: string;
  label: string;
  /** 0 bis 100. `null`, wenn keine Messung vorliegt. */
  value: number | null;
  /** Die Einordnung in Worten, etwa „Angst" oder „Gier". */
  classification: string;
  /** §30, Pflichtangabe 1: woher der Wert stammt. */
  source: string;
  /** §30, Pflichtangabe 2: welchen Zeitraum er abdeckt. */
  period: { from: string; to: string };
  /** §30, Pflichtangabe 3: wie viele Beobachtungen dahinterstehen. */
  sampleSize: number;
  /** §30, Pflichtangabe 4: wie belastbar der Wert ist. */
  confidence: SentimentConfidence;
  /** Warum diese Konfidenz — ohne Begründung wäre die Stufe selbst eine Behauptung. */
  confidenceReason: string;
  /** Was der Wert **nicht** sagt. */
  caveat: string;
};

/**
 * Leitet die Konfidenz aus Datenmenge und Alter ab.
 *
 * Bewusst nur aus diesen beiden: alles Weitere wäre geraten. Ein Wert aus
 * wenigen Beobachtungen ist unsicher, und ein alter Wert beschreibt nicht die
 * heutige Stimmung — beides ist messbar, anders als etwa die Güte der
 * Erhebungsmethode.
 */
export function deriveConfidence(sampleSize: number, ageDays: number): { level: SentimentConfidence; reason: string } {
  if (sampleSize <= 0) {
    return { level: "niedrig", reason: "Keine Beobachtungen." };
  }
  if (ageDays > 7) {
    return {
      level: "niedrig",
      reason: `Der Wert ist ${Math.round(ageDays)} Tage alt und beschreibt nicht die heutige Stimmung.`
    };
  }
  if (sampleSize < 10) {
    return {
      level: "niedrig",
      reason: `Nur ${sampleSize} Beobachtungen. Einzelne Ausreißer bestimmen das Ergebnis.`
    };
  }
  if (sampleSize < 30 || ageDays > 2) {
    return {
      level: "mittel",
      reason: `${sampleSize} Beobachtungen, ${Math.round(ageDays)} Tage alt.`
    };
  }
  return { level: "hoch", reason: `${sampleSize} Beobachtungen, höchstens zwei Tage alt.` };
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

export type FearGreedPoint = { timestamp: number; value: number; classification: string };

/**
 * Wertet den Krypto-Angst-und-Gier-Index aus.
 *
 * Am 2026-08-08 gemessen: `api.alternative.me/fng` antwortet ohne Schlüssel und
 * liefert Werte als **Zeichenketten** — `value: "31"`, nicht `31`. Wer das
 * übersieht, bekommt aus `Number(undefined)` ein `NaN` oder vergleicht
 * Zeichenketten der Länge nach.
 */
export function parseFearGreed(raw: unknown): FearGreedPoint[] {
  const rows = Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: unknown[] }).data : [];

  return rows.flatMap((row): FearGreedPoint[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;

    const value = Number(entry.value);
    const timestamp = Number(entry.timestamp);
    if (!Number.isFinite(value) || !Number.isFinite(timestamp)) return [];

    return [
      {
        timestamp: timestamp * 1000,
        value,
        classification: typeof entry.value_classification === "string" ? entry.value_classification : "unbekannt"
      }
    ];
  });
}

const fearGreedGerman: Record<string, string> = {
  "Extreme Fear": "Extreme Angst",
  Fear: "Angst",
  Neutral: "Neutral",
  Greed: "Gier",
  "Extreme Greed": "Extreme Gier"
};

export function buildFearGreedReading(points: readonly FearGreedPoint[], now = new Date()): SentimentReading | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((left, right) => right.timestamp - left.timestamp);
  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];
  const ageDays = daysBetween(new Date(latest.timestamp), now);
  const confidence = deriveConfidence(sorted.length, ageDays);

  return {
    id: "crypto_fear_greed",
    label: "Angst und Gier (Krypto)",
    value: latest.value,
    classification: fearGreedGerman[latest.classification] ?? latest.classification,
    source: "alternative.me Fear & Greed Index",
    period: {
      from: new Date(oldest.timestamp).toISOString().slice(0, 10),
      to: new Date(latest.timestamp).toISOString().slice(0, 10)
    },
    sampleSize: sorted.length,
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    caveat:
      "Ein zusammengesetzter Index aus Volatilität, Volumen, Umfragen und Suchanfragen. Er misst die Stimmung am Kryptomarkt, nicht die eines einzelnen Instruments — und Stimmung ist kein Kursziel."
  };
}

/**
 * Stimmung aus Nachrichten.
 *
 * Die Datenmenge ist hier der entscheidende Teil: dieselbe Zahl aus drei und
 * aus dreihundert Meldungen sieht identisch aus und bedeutet etwas völlig
 * anderes. §30 verlangt sie deshalb ausdrücklich.
 */
export function buildNewsSentimentReading(
  items: readonly { sentiment: "positive" | "neutral" | "negative"; publishedAt: string }[],
  now = new Date()
): SentimentReading | null {
  if (items.length === 0) return null;

  const timestamps = items
    .map((item) => new Date(item.publishedAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (timestamps.length === 0) return null;

  const score = { positive: 100, neutral: 50, negative: 0 } as const;
  const value = Math.round(items.reduce((sum, item) => sum + score[item.sentiment], 0) / items.length);

  const ageDays = daysBetween(new Date(timestamps[timestamps.length - 1]), now);
  const confidence = deriveConfidence(items.length, ageDays);

  return {
    id: "news_sentiment",
    label: "Nachrichtenstimmung",
    value,
    classification: value >= 65 ? "Positiv" : value <= 35 ? "Negativ" : "Gemischt",
    source: "Nachrichtenanbieter, modellbasierte Einstufung je Meldung",
    period: {
      from: new Date(timestamps[0]).toISOString().slice(0, 10),
      to: new Date(timestamps[timestamps.length - 1]).toISOString().slice(0, 10)
    },
    sampleSize: items.length,
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    caveat:
      "Die Einstufung je Meldung ist modellbasiert und nicht geprüft. Eine positive Nachrichtenlage ist außerdem oft bereits im Kurs enthalten."
  };
}

/**
 * Erwartete Schwankung als Stimmungsmaß.
 *
 * Der VIX ist **umgekehrt** zu lesen: hohe Werte bedeuten Nervosität, also
 * schlechte Stimmung. Ohne diese Umkehrung stünde ein Angstwert neben zwei
 * Gierwerten auf derselben Skala und würde falsch gelesen.
 */
export function buildVolatilityReading(
  observations: readonly { period: string; value: number }[],
  now = new Date()
): SentimentReading | null {
  if (observations.length === 0) return null;

  const latest = observations[observations.length - 1];
  const latestDate = new Date(`${latest.period}T00:00:00.000Z`);
  if (!Number.isFinite(latestDate.getTime())) return null;

  const ageDays = daysBetween(latestDate, now);
  const confidence = deriveConfidence(observations.length, ageDays);

  // Umgerechnet auf dieselbe Skala wie die uebrigen Werte: 0 = groesste Angst.
  // Ein VIX von 10 gilt als sehr ruhig, 40 als sehr nervoes.
  const calm = Math.round(Math.max(0, Math.min(100, ((40 - latest.value) / 30) * 100)));

  return {
    id: "volatility_sentiment",
    label: "Nervosität am Markt (VIX)",
    value: calm,
    classification: latest.value >= 30 ? "Sehr nervös" : latest.value >= 20 ? "Nervös" : "Ruhig",
    source: "CBOE Volatility Index via FRED",
    period: { from: observations[0].period, to: latest.period },
    sampleSize: observations.length,
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    caveat: `VIX steht bei ${latest.value.toFixed(1)}. Der Index misst die erwartete Schwankung der nächsten 30 Tage, nicht die Richtung — hohe Werte kommen in Auf- wie Abwärtsphasen vor.`
  };
}

export type SentimentOverview = {
  readings: SentimentReading[];
  /** Was §30 nennt und hier nicht möglich ist — namentlich. */
  unavailable: string[];
  note: string;
};

/**
 * Fasst zusammen — **ohne** die Werte zu einem Gesamtsentiment zu verrechnen.
 *
 * Ein Mittelwert aus Nachrichtenstimmung, Krypto-Index und Volatilität wäre
 * eine Zahl ohne Gegenstand: die drei messen verschiedene Märkte über
 * verschiedene Zeiträume mit verschiedener Datenmenge. Sie stehen deshalb
 * nebeneinander.
 */
export function buildSentimentOverview(readings: readonly (SentimentReading | null)[]): SentimentOverview {
  const usable = readings.filter((reading): reading is SentimentReading => reading !== null);

  return {
    readings: usable,
    // Am 2026-08-08 geprueft: CNN antwortet mit HTTP 418 (Bot-Erkennung), fuer
    // Put/Call gibt es bei FRED keine Reihe, und Reddit und Social Media sind
    // ohne eigene Erhebung nicht verfuegbar.
    unavailable: [
      "Fear & Greed für Aktien (CNN sperrt automatisierte Zugriffe)",
      "Put/Call-Ratio (keine freie Quelle gefunden)",
      "Reddit und Social Media (keine Anbindung)"
    ],
    note: usable.length
      ? "Die Werte stehen nebeneinander und werden nicht zu einem Gesamtsentiment verrechnet — sie messen verschiedene Märkte über verschiedene Zeiträume."
      : "Für keine Stimmungsquelle liegen derzeit Daten vor."
  };
}
