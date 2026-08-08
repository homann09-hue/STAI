/**
 * Duplikate erkennen und zusammenführen.
 *
 * Dieselbe Meldung läuft über Reuters, Bloomberg, Yahoo und drei Aggregatoren.
 * Ohne Zusammenführung sieht ein Feed nach sechs Ereignissen aus, wo eines war
 * — und ein Impact-Score, der über sechs Einträge summiert, wird schlicht
 * falsch.
 *
 * **Der Fehler, gegen den hier gebaut wird, ist der zweite, nicht der erste.**
 * Ein zu eifriger Vergleich führt zwei verschiedene Meldungen über dasselbe
 * Unternehmen zusammen und lässt eine davon verschwinden. Ein verschluckter
 * Ausfall wiegt schwerer als ein doppelter Eintrag, deshalb ist die Schwelle
 * bewusst hoch und das Zeitfenster eng.
 *
 * Marketaux liefert im vorhandenen Tarif ein leeres `similar`-Feld — die
 * Zusammenführung muss also selbst gerechnet werden.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

import type { NewsItem } from "@/lib/types";

/**
 * Wörter ohne Unterscheidungskraft.
 *
 * Sie stehen in fast jeder Finanzmeldung. Bleiben sie drin, ähneln sich zwei
 * beliebige Schlagzeilen bereits zu 30 % — und die Schwelle würde wertlos.
 */
const stopWords = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by", "from", "as", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "will", "has", "have", "after", "over", "up", "down",
  "new", "say", "said", "inc", "corp", "ltd", "plc",
  "der", "die", "das", "und", "oder", "von", "zu", "im", "auf", "für", "mit", "bei", "aus", "ist", "sind"
]);

/**
 * Vereinheitlicht Beugungsformen.
 *
 * Ohne diesen Schritt gelten „acquires" und „acquire" als verschiedene Wörter
 * — und genau darin unterscheiden sich zwei Häuser, die dieselbe Meldung
 * bringen. Beim ersten Versuch kam ein eindeutiges Paar deshalb nur auf 0,44
 * statt über die Schwelle.
 *
 * Bewusst grob: eine echte Stammformreduktion braucht ein Wörterbuch je
 * Sprache, und ein falscher Stamm führt Meldungen zusammen, die nicht
 * zusammengehören.
 */
function stem(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  // Nur das einzelne "s". Ein zusaetzliches "es"-Muster machte aus "acquires"
  // ein "acquir" und damit etwas anderes als "acquire" -- genau die
  // Beugungsdifferenz, die hier verschwinden soll.
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
      // Erst die Stammform, dann der Filter. Andersherum rutschen gebeugte
      // Fuellwoerter durch: "says" stand nicht in der Liste, "say" schon.
      .map(stem)
      .filter((token) => !stopWords.has(token))
  );
}

/**
 * Wie viele unterscheidende Wörter ein Titel mindestens haben muss.
 *
 * Der gefährlichste Fall, den der erste Entwurf hatte: bleibt nach dem Filtern
 * genau **ein** Wort übrig, sind zwei völlig verschiedene Schlagzeilen zu
 * 100 % ähnlich. Eine zu kurze Wortmenge erlaubt keine Aussage — und liefert
 * deshalb 0 statt einer hohen Ähnlichkeit.
 */
const MIN_DISTINCT_TOKENS = 3;

/**
 * Ähnlichkeit zweier Titel als Jaccard-Index über die Wortmengen.
 *
 * Bewusst kein Verfahren mit Reihenfolge: dieselbe Meldung wird von jedem
 * Haus anders formuliert, aber mit denselben Substantiven.
 */
export function titleSimilarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  // Zu wenige unterscheidende Woerter heisst: keine Aussage moeglich. 0 statt
  // einer hohen Aehnlichkeit -- sonst waeren zwei nichtssagende Schlagzeilen
  // identisch.
  if (leftTokens.size < MIN_DISTINCT_TOKENS || rightTokens.size < MIN_DISTINCT_TOKENS) return 0;

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }

  const union = leftTokens.size + rightTokens.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Ab welcher Ähnlichkeit zwei Titel als dieselbe Meldung gelten.
 *
 * 0,6 heißt: knapp zwei Drittel der bedeutungstragenden Wörter stimmen
 * überein. Kalibriert gegen den Fall „Apple beats Q3 estimates" gegen „Apple
 * misses Q3 estimates" — zwei gegensätzliche Meldungen mit fast gleichem
 * Wortlaut, die **nicht** zusammengeführt werden dürfen.
 */
const SIMILARITY_THRESHOLD = 0.6;

/** Wie weit zwei Meldungen auseinanderliegen dürfen, um dieselbe zu sein. */
const MAX_DISTANCE_MS = 48 * 60 * 60 * 1000;

export type NewsCluster = {
  /**
   * Die zuerst veröffentlichte Meldung.
   *
   * Bewusst die früheste und nicht die „beste": wer zuerst berichtet hat, hat
   * berichtet. Jede andere Wahl wäre eine Wertung der Quellen.
   */
  primary: NewsItem;
  duplicates: NewsItem[];
  /** Alle Quellen, die dieselbe Meldung gebracht haben. */
  sources: string[];
};

export type DedupeResult = {
  clusters: NewsCluster[];
  /** Wie viele Einträge zusammengeführt wurden. Gehört in die Metadaten. */
  mergedCount: number;
};

function publishedMs(item: NewsItem) {
  const value = new Date(item.publishedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function normalizedUrl(item: NewsItem) {
  if (!item.url || item.url === "#") return null;
  try {
    const url = new URL(item.url);
    // Kampagnenparameter unterscheiden dieselbe Seite nicht.
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

/**
 * Führt gleiche Meldungen zusammen.
 *
 * Zwei Einträge gelten als dieselbe Meldung, wenn die bereinigte URL
 * übereinstimmt — oder wenn Titel und Zeitpunkt beides nahe genug sind. Die
 * Zeitbedingung ist kein Beiwerk: ohne sie würden die Quartalszahlen dieses
 * und des letzten Jahres zusammenfallen.
 */
export function clusterNews(items: readonly NewsItem[]): DedupeResult {
  const sorted = [...items].sort((left, right) => publishedMs(left) - publishedMs(right));
  const clusters: NewsCluster[] = [];

  for (const item of sorted) {
    const itemUrl = normalizedUrl(item);

    const match = clusters.find((cluster) => {
      const primaryUrl = normalizedUrl(cluster.primary);
      if (itemUrl && primaryUrl && itemUrl === primaryUrl) return true;

      if (Math.abs(publishedMs(item) - publishedMs(cluster.primary)) > MAX_DISTANCE_MS) return false;
      return titleSimilarity(item.title, cluster.primary.title) >= SIMILARITY_THRESHOLD;
    });

    if (match) {
      match.duplicates.push(item);
      if (!match.sources.includes(item.source)) match.sources.push(item.source);
      continue;
    }

    clusters.push({ primary: item, duplicates: [], sources: [item.source] });
  }

  // Neueste zuerst -- das ist die Erwartung an einen Nachrichtenfeed.
  clusters.sort((left, right) => publishedMs(right.primary) - publishedMs(left.primary));

  return {
    clusters,
    mergedCount: clusters.reduce((sum, cluster) => sum + cluster.duplicates.length, 0)
  };
}
