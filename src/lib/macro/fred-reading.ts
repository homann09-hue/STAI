/**
 * Übersetzung einer FRED-Reihe in die gemeinsame Auswertung.
 *
 * `fred.ts` war vollständig gebaut — Katalog, Parser, Abruf, Lizenzstand je
 * Reihe — und wurde von **keiner Zeile** außerhalb der eigenen Tests
 * importiert. Nach §90 ist das dieselbe Sorte Fassade wie ein Limit, das nichts
 * begrenzt: es sieht aus, als gäbe es US-Makrodaten, und in der Anwendung gab
 * es sie nicht.
 *
 * Diese Datei ist das fehlende Stück. Sie ist rein und ohne Netzzugriff, damit
 * die Übersetzung ohne Abruf prüfbar bleibt.
 */

import type { MacroReadingSource } from "@/lib/macro/analysis";
import { fredCitation, type FredFrequency, type FredSeriesDefinition } from "@/lib/macro/fred";
import type { MacroFrequency } from "@/lib/macro/series";

/**
 * FRED nennt Tagesreihen „daily", liefert aber nur Handelstage.
 *
 * Gemessen am 2026-08-09: `DGS3MO` hat seit 1982 rund 11 700 Beobachtungen —
 * bei echten Kalendertagen wären es gut 16 000. Die Reihen überspringen
 * Wochenenden und Feiertage.
 *
 * Der Unterschied ist nicht kosmetisch: die Altersbewertung in `analysis.ts`
 * trennt beide Frequenzen, und eine Rendite vom Freitag ist am Montag nicht
 * „verspätet", sondern die jüngste, die es gibt.
 */
const frequencyMap: Record<FredFrequency, MacroFrequency> = {
  daily: "business_daily",
  monthly: "monthly",
  quarterly: "quarterly"
};

/** Die Seite, auf der die Reihe samt Lizenzstand nachlesbar ist. */
export function fredSeriesPageUrl(series: FredSeriesDefinition) {
  return `https://fred.stlouisfed.org/series/${series.seriesId}`;
}

/**
 * Macht aus der FRED-Definition eine auswertbare Reihe.
 *
 * Die Quellenangabe ist hier die **Ursprungsbehörde via FRED**, nicht „FRED".
 * Das ist keine Höflichkeit: FRED verlangt sie, und der Verbraucherpreisindex
 * stammt vom US-Arbeitsministerium, nicht von der Fed in St. Louis.
 */
export function toMacroReadingSource(series: FredSeriesDefinition): MacroReadingSource {
  return {
    id: series.id,
    label: series.label,
    explanation: series.explanation,
    unit: series.unit,
    frequency: frequencyMap[series.frequency],
    valueSuffix: series.valueSuffix ?? null,
    source: fredCitation(series).replace(/^Quelle: /, ""),
    sourceUrl: fredSeriesPageUrl(series)
  };
}

/**
 * Der Hinweis, der bei einer abgeleiteten Reihe mitlaufen muss.
 *
 * `PAYEMS` liefert den Beschäftigungs**bestand**; berichtet wird die monatliche
 * Veränderung. Die Zahl, die der Nutzer sieht, steht so bei FRED nicht — und
 * das gehört dazu.
 */
export function derivationCaveat(series: FredSeriesDefinition): string | null {
  return series.reportAsChange
    ? "Abgeleitet: Die Quelle meldet den Beschäftigungsbestand, angezeigt ist die Veränderung zum Vormonat."
    : null;
}

/**
 * Der Lizenzhinweis, der bei geschützten Reihen sichtbar sein muss.
 *
 * Nur eine Reihe im Katalog ist `citation_required` — das Konsumentenvertrauen
 * der Universität Michigan. Der Hinweis hängt deshalb an der Reihe und nicht am
 * Gesamtblock: sonst stünde er entweder überall falsch oder nirgends.
 */
export function licenceCaveat(series: FredSeriesDefinition): string | null {
  return series.copyright === "citation_required"
    ? `Urheberrechtlich geschützte Reihe. Nutzung nur mit Quellenangabe: ${series.originalSource}.`
    : null;
}
