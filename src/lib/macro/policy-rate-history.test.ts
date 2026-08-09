import { describe, expect, it } from "vitest";
import { derivePolicyRatePath, describePolicyStance } from "@/lib/macro/policy-rate-history";
import type { MacroObservation } from "@/lib/macro/sdmx";

/**
 * Der Leitzinspfad ist die einzige Stelle, an der StockPilot aus Kursdaten eine
 * Aussage über Zentralbankhandeln ableitet. Die Tests prüfen deshalb vor allem
 * die Grenzen dieser Ableitung — was sie gerade nicht behaupten darf.
 */

const now = new Date("2026-08-08T00:00:00.000Z");

function series(entries: Array<[string, number]>): MacroObservation[] {
  return entries.map(([period, value]) => ({ period, value }));
}

describe("derivePolicyRatePath", () => {
  it("erkennt eine Senkung mit Wirksamkeitsdatum und Schrittweite", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-06-01", 2.4],
        ["2026-06-02", 2.4],
        ["2026-06-03", 2.15]
      ]),
      now
    );

    expect(path.changes).toHaveLength(1);
    expect(path.changes[0]).toMatchObject({
      effectiveFrom: "2026-06-03",
      previousRate: 2.4,
      newRate: 2.15,
      deltaPercentagePoints: -0.25,
      direction: "cut"
    });
  });

  it("zählt die erste Beobachtung nicht als Zinsschritt", () => {
    // Sonst entstünde bei jedem Abruf eine erfundene Entscheidung, die nur
    // daher rührt, wo das Zeitfenster beginnt.
    const path = derivePolicyRatePath(series([["2026-06-01", 2.4]]), now);

    expect(path.changes).toHaveLength(0);
    expect(path.currentRate).toBe(2.4);
  });

  it("unterscheidet „keine Änderung im Fenster“ von „nie geändert“", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-07-01", 2.4],
        ["2026-08-01", 2.4]
      ]),
      now
    );

    expect(path.changes).toHaveLength(0);
    expect(path.lastChange).toBeNull();
    expect(path.notes[0]).toMatch(/nicht, dass es davor keine gab/);
  });

  it("nennt das Fenster, auf das sich die Aussage bezieht", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-01-02", 3.0],
        ["2026-08-07", 2.4]
      ]),
      now
    );

    expect(path.windowStart).toBe("2026-01-02");
    expect(path.windowEnd).toBe("2026-08-07");
    expect(path.notes.join(" ")).toMatch(/2026-01-02 bis 2026-08-07/);
  });

  it("behauptet nicht, das Datum sei der Sitzungstag", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-06-01", 2.4],
        ["2026-06-03", 2.15]
      ]),
      now
    );

    expect(path.notes.join(" ")).toMatch(/nicht der Tag der Ratssitzung/);
    expect(path.notes.join(" ")).toMatch(/Künftige Sitzungstermine .* nicht/);
  });

  it("rechnet die Tage seit dem letzten Schritt", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-07-01", 2.4],
        ["2026-07-09", 2.65]
      ]),
      now
    );

    expect(path.daysSinceLastChange).toBe(30);
    expect(path.changes[0].direction).toBe("hike");
  });

  it("verwirft unlesbare Zeitpunkte, statt sie zu zählen", () => {
    const path = derivePolicyRatePath(
      [
        { period: "2026-07-01", value: 2.4 },
        { period: "irgendwann", value: 9.9 },
        { period: "2026-07-02", value: 2.4 }
      ],
      now
    );

    expect(path.changes).toHaveLength(0);
    expect(path.currentRate).toBe(2.4);
  });

  it("begrenzt die Liste und zeigt die jüngsten Schritte zuerst", () => {
    const entries: Array<[string, number]> = [];
    for (let index = 0; index < 20; index += 1) {
      entries.push([`2026-01-${String(index + 1).padStart(2, "0")}`, 1 + index * 0.25]);
    }

    const path = derivePolicyRatePath(series(entries), now);

    expect(path.changes).toHaveLength(12);
    expect(path.changes[0].effectiveFrom).toBe("2026-01-20");
    // lastChange bleibt der tatsaechlich juengste Schritt, unabhaengig von der
    // Kuerzung der Liste.
    expect(path.lastChange?.effectiveFrom).toBe("2026-01-20");
  });

  it("gibt ohne Beobachtungen keinen Zinssatz aus", () => {
    const path = derivePolicyRatePath([], now);

    expect(path.currentRate).toBeNull();
    expect(path.notes[0]).toMatch(/keine auswertbaren Beobachtungen/);
  });
});

describe("describePolicyStance", () => {
  it("beschreibt den letzten Schritt in einem Satz", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-07-01", 2.4],
        ["2026-07-09", 2.15]
      ]),
      now
    );

    const description = describePolicyStance(path);
    expect(description).toMatch(/2,15 %/);
    expect(description).toMatch(/0,25 Prozentpunkte gesenkt/);
    expect(description).toMatch(/seit 30 Tagen unverändert/);
  });

  it("ruft aus mehreren Schritten keinen Zyklus aus", () => {
    const path = derivePolicyRatePath(
      series([
        ["2026-01-01", 3.0],
        ["2026-02-01", 2.75],
        ["2026-03-01", 2.5]
      ]),
      now
    );

    const description = describePolicyStance(path);
    // Beschreiben, nicht deuten: kein "Zinssenkungszyklus", keine Prognose.
    expect(description).toMatch(/Alle 2 Schritte im Fenster gingen in dieselbe Richtung/);
    expect(description).not.toMatch(/Zyklus|erwartet|dürfte|wird weiter/i);
  });

  it("beugt Ein- und Mehrzahl richtig", () => {
    // Der Live-Abruf lieferte „1 Anhebungen und 8 Senkungen". Ein Produkt, das
    // Vertrauen beansprucht, darf an solchen Stellen nicht schludern.
    const path = derivePolicyRatePath(
      series([
        ["2026-01-01", 2.15],
        ["2026-02-01", 2.4],
        ["2026-03-01", 2.15],
        ["2026-04-01", 1.9]
      ]),
      now
    );

    const description = describePolicyStance(path);
    expect(description).toMatch(/1 Anhebung und 2 Senkungen/);
    expect(description).not.toMatch(/1 Anhebungen/);
  });

  it("sagt bei fehlenden Daten, dass keine vorliegen", () => {
    expect(describePolicyStance(derivePolicyRatePath([], now))).toMatch(/keine Daten/);
  });
});
