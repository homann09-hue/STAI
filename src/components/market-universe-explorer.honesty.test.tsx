// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ein Filtername ist in einem Finanzprodukt eine Aussage über die Zeilen, die
 * er übrig lässt.
 *
 * Zwei Schnellfilter hießen „Momentum" und „Income/ETF" und filterten nach der
 * **Assetklasse**: `momentum` ließ jede Aktie, jede Kryptowährung und jeden
 * Index durch, `income` jeden ETF und jeden Fonds. Es wurde kein Momentum
 * gemessen und keine Ausschüttung geprüft. Wer „Momentum" anklickte und das
 * gesamte Aktienuniversum bekam, hielt das Ergebnis für eine Auswahl.
 *
 * Diese Tests lesen die Quelltexte, weil genau das die Zusicherung ist: nicht
 * „die Komponente rendert", sondern „im Code steht kein Versprechen, das der
 * Code nicht hält".
 */

const explorerSource = readFileSync(
  join(process.cwd(), "src/components/market-universe-explorer.tsx"),
  "utf8"
);
const screenerPageSource = readFileSync(join(process.cwd(), "src/app/screener/page.tsx"), "utf8");

/** Kennzahlen, nach denen im Universum **nicht** gefiltert werden kann. */
const unavailableMetrics = [
  "Marktkapitalisierung",
  "KGV",
  "Dividende",
  "Volatilität",
  "Performance",
  "Volumen"
];

describe("Schnellfilter heißen, was sie tun", () => {
  it("wirbt nicht mehr mit Momentum", () => {
    // Der Filter existiert weiter -- er filtert nach Assetklasse und heisst
    // jetzt auch so. Entfernt wurde die Behauptung, nicht die Funktion.
    expect(explorerSource).not.toMatch(/label: "Momentum"/);
    expect(explorerSource).toMatch(/label: "Aktien, Krypto & Indizes"/);
  });

  it("wirbt nicht mehr mit Income", () => {
    expect(explorerSource).not.toMatch(/label: "Income\/ETF"/);
    expect(explorerSource).toMatch(/label: "ETFs & Fonds"/);
  });

  it("sagt bei beiden dazu, was sie nicht prüfen", () => {
    expect(explorerSource).toMatch(/nicht nach gemessenem Momentum/);
    expect(explorerSource).toMatch(/Ausschüttungen und Kosten werden hier nicht geprüft/);
  });

  it("filtert weiterhin nach Assetklasse — die Funktion bleibt", () => {
    expect(explorerSource).toMatch(/preset === "momentum" && !momentumAssetClasses\.includes/);
    expect(explorerSource).toMatch(/preset === "income" && !incomeAssetClasses\.includes/);
  });
});

describe("Die Seite verspricht keine Filter, die es nicht gibt", () => {
  it("nennt in der Filterkarte nur vorhandene Kriterien", () => {
    // Die Karte listete elf Filter auf, darunter KGV, Dividende und
    // Volatilitaet. Keiner davon existiert -- gefiltert wird nach Assetklasse,
    // Abdeckung und Freitext.
    const filterCard = screenerPageSource.match(/\{ title: "Filter", text: "([^"]+)"/)?.[1] ?? "";

    expect(filterCard.length).toBeGreaterThan(20);
    for (const metric of unavailableMetrics) {
      expect(filterCard).not.toContain(metric);
    }
  });

  it("benennt die fehlenden Filter als fehlend, statt sie zu verschweigen", () => {
    // Weglassen waere ehrlich, aber wenig hilfreich. Der Nutzer soll wissen,
    // dass es diese Filter nicht gibt -- und warum.
    const openCard = screenerPageSource.match(/\{ title: "Noch nicht da", text: "([^"]+)"/)?.[1] ?? "";

    expect(openCard).toContain("Marktkapitalisierung");
    expect(openCard).toContain("KGV");
    expect(openCard).toContain("Anbietertarif");
  });

  it("trägt kein Werbe-Badge an einer unfertigen Karte", () => {
    // "Live-ready" stand an der Karte mit den elf erfundenen Filtern.
    expect(screenerPageSource).not.toMatch(/badge: "Live-ready"/);
  });
});
