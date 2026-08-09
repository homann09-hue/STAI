import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { featureDefinitions, getFeatureGateStatus, type FeatureId } from "@/lib/feature-gates";

/**
 * Der Wächter gegen die Fassade, die dieses Projekt am häufigsten produziert
 * hat: eine Funktion, die im Tarif als **enthalten** steht, aber von keiner
 * Route durchgesetzt wird.
 *
 * `statusMap` kennt drei Zustände:
 *
 * | Zustand | Bedeutung |
 * |---|---|
 * | `demo` | Geplant, im vorgesehenen Tarif angekündigt |
 * | `locked` | Nicht in diesem Tarif |
 * | `included` | **Leistung.** Wird verkauft, muss also existieren |
 *
 * `included` ist eine wirtschaftliche Zusage. Als ich `backtesting` von `demo`
 * auf `included` gezogen habe, blieben alle 799 Tests grün — genau die Lücke,
 * die bei den Mock-Daten schon einmal offen war. Diese Datei schließt sie:
 * **wer verkauft wird, braucht eine Route.**
 */

const routeDirectory = join(process.cwd(), "src/app/api");

function collectRouteSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectRouteSources(path);
    return entry === "route.ts" ? [readFileSync(path, "utf8")] : [];
  });
}

const routeSources = collectRouteSources(routeDirectory);

/** Welche Funktionen irgendeine Route per `requireFeature` durchsetzt. */
const enforced = new Set<string>(
  routeSources.flatMap((source) => [...source.matchAll(/requireFeature\([^,]+,\s*"([a-z_]+)"/g)].map((match) => match[1]))
);

/**
 * Funktionen, die als Leistung gelten, ohne eine eigene Route zu haben.
 *
 * Jede Zeile hier ist eine bewusste Entscheidung mit Begründung — keine
 * Sammelstelle. Wächst diese Liste ohne Grund, ist der Test wertlos geworden.
 */
const enforcedElsewhere: Partial<Record<FeatureId, string>> = {
  // Mengenbegrenzungen statt Zugang: die Routen pruefen `maxWatchlistItems`,
  // `maxAlerts` und `portfolios` ueber `consumeQuota` bzw. direkt.
  watchlist: "Mengenlimit in /api/watchlist",
  alerts: "Mengenlimit in /api/alerts",
  portfolio: "Mengenlimit in /api/portfolio/books",
  // Im kostenlosen Tarif fuer jeden enthalten -- es gibt nichts zu gaten.
  market_dashboard: "In jedem Tarif enthalten",
  asset_analysis: "In jedem Tarif enthalten",
  learning: "In jedem Tarif enthalten",
  ai_news: "Tagesquote statt Zugangspruefung"
};

describe("Was verkauft wird, muss es geben", () => {
  const sellable = featureDefinitions.filter(
    (feature) =>
      getFeatureGateStatus("pro", feature.id) === "included" ||
      getFeatureGateStatus("premium", feature.id) === "included"
  );

  it("findet überhaupt Routen zum Prüfen", () => {
    // Ohne diese Zusicherung wuerde der Test bei einer Umbenennung des
    // Verzeichnisses stillschweigend alles durchwinken.
    expect(routeSources.length).toBeGreaterThan(20);
    expect(enforced.size).toBeGreaterThan(0);
  });

  /**
   * Verkauft, aber noch von keiner Route durchgesetzt.
   *
   * Diese vier hat der Test bei seinem ersten Lauf gefunden. Sie sind **kein**
   * Freibrief: `docs/PROGRESS_MATRIX.md` führt sie unter §4, und die Zusicherung
   * unten ist eine Sperrklinke — die Liste darf schrumpfen, nicht wachsen.
   *
   * Sie hier einzutragen statt den Test zu löschen ist der Unterschied zwischen
   * bekannter Schuld und einer Fassade. Warum sie nicht sofort geschlossen
   * wurden: bei allen vieren hängt an der Route auch Funktion, die ein
   * kostenloses Konto behalten soll (Suche, Portfolioliste). Wo genau die
   * Grenze verläuft, ist eine Produktentscheidung und keine technische.
   */
  const knownUnenforced: FeatureId[] = [
    "screener",
    "risk_analysis",
    "scenario_analysis",
    "portfolio_risk"
  ];

  it("setzt jede verkaufte Funktion serverseitig durch", () => {
    const unenforced = sellable
      .map((feature) => feature.id)
      .filter((id) => !enforced.has(id) && !(id in enforcedElsewhere));

    // Keine neue Funktion darf ungegatet dazukommen.
    expect(unenforced.filter((id) => !knownUnenforced.includes(id))).toEqual([]);
  });

  it("lässt die Liste der ungegateten Funktionen nicht wachsen", () => {
    const unenforced = sellable
      .map((feature) => feature.id)
      .filter((id) => !enforced.has(id) && !(id in enforcedElsewhere));

    // Wird eine davon gegatet, schlaegt dieser Test fehl und erinnert daran,
    // sie aus `knownUnenforced` zu streichen. Eine Schuldenliste, die niemand
    // aufraeumt, ist selbst eine Fassade.
    expect(unenforced.sort()).toEqual([...knownUnenforced].sort());
  });

  it("erzwingt Backtesting über eine Route", () => {
    // Namentlich, weil genau diese Funktion bis zum 2026-08-09 ein
    // Zinseszinsrechner war und trotzdem im Tarif stand.
    expect(getFeatureGateStatus("pro", "backtesting")).toBe("included");
    expect(getFeatureGateStatus("free", "backtesting")).toBe("locked");
    expect(enforced.has("backtesting")).toBe(true);
  });

  it("hält die Ausnahmeliste klein und begründet", () => {
    for (const [id, reason] of Object.entries(enforcedElsewhere)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(featureDefinitions.some((feature) => feature.id === id)).toBe(true);
    }

    expect(Object.keys(enforcedElsewhere).length).toBeLessThanOrEqual(10);
  });
});
