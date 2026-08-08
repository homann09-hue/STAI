// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MacroOverviewView } from "./macro-overview-view";
import { buildMacroOverview, buildMacroReading } from "@/lib/macro/analysis";
import { findMacroSeries } from "@/lib/macro/series";

/**
 * Der Wert dieser Ansicht liegt nicht in den Zahlen, sondern darin, dass neben
 * jeder Zahl steht, von wann sie ist. Die Tests prüfen deshalb vor allem, dass
 * ein alter Wert nicht wie ein aktueller aussieht.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const now = new Date("2026-08-08T00:00:00.000Z");

function reading(id: string, period: string, value: number) {
  const definition = findMacroSeries(id);
  if (!definition) throw new Error(`Reihe ${id} fehlt`);
  const result = buildMacroReading(definition, [{ period, value }], now);
  if (!result) throw new Error(`Reihe ${id} lieferte keinen Wert`);
  return result;
}

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => payload })) as unknown as typeof fetch
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MacroOverviewView", () => {
  it("zeigt Wert, Stichtag und Datenalter gemeinsam", async () => {
    const policyRate = reading("ea_policy_rate", "2026-08-08", 2.4);
    stubFetch(buildMacroOverview([policyRate], []));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(screen.getByText(/EZB-Leitzins/)).toBeTruthy());
    const visible = container.textContent ?? "";
    expect(visible).toMatch(/2,40 %/);
    expect(visible).toMatch(/Stand 2026-08-08/);
    expect(visible).toMatch(/heute/);
  });

  it("kennzeichnet einen veralteten Wert sichtbar als veraltet", async () => {
    // Der HVPI lag bei der Messung 220 Tage zurueck. Genau dieser Fall darf
    // nicht wie eine aktuelle Inflationsrate aussehen.
    const inflation = reading("ea_inflation_hicp", "2025-12", 1.9);
    stubFetch(buildMacroOverview([inflation], []));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(screen.getByText("veraltet")).toBeTruthy());
    expect(container.textContent ?? "").toMatch(/beschreibt nicht die heutige Lage/);
  });

  it("nennt eine verweigerte Zinsstruktur beim Namen, statt sie wegzulassen", async () => {
    const shortEnd = reading("ea_yield_3m", "2026-01-15", 2.0);
    const longEnd = reading("ea_yield_10y", "2026-08-06", 3.14);
    stubFetch(buildMacroOverview([shortEnd, longEnd], []));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(container.textContent).toMatch(/Zinsstruktur/));
    expect(container.textContent ?? "").toMatch(/Scheingenauigkeit/);
  });

  it("weist fehlende Reihen aus, statt sie stillschweigend zu verschweigen", async () => {
    const policyRate = reading("ea_policy_rate", "2026-08-08", 2.4);
    stubFetch(buildMacroOverview([policyRate], ["ea_inflation_hicp", "eur_usd"]));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(container.textContent).toMatch(/Nicht geladene Reihen/));
    expect(container.textContent ?? "").toMatch(/durch einen Ersatzwert ersetzt/);
  });

  it("zeigt bei einem Fehler keine Ersatzwerte", async () => {
    stubFetch({ error: "kaputt" }, false);

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(screen.getByText(/nicht verfügbar/i)).toBeTruthy());
    const visible = container.textContent ?? "";
    expect(visible).toMatch(/keine Ersatzwerte/);
    // Entscheidend: keine einzige Zahl im Dokument.
    expect(visible).not.toMatch(/\d+,\d+\s?%/);
  });

  it("trägt die Quellenangabe der EZB immer mit", async () => {
    const policyRate = reading("ea_policy_rate", "2026-08-08", 2.4);
    stubFetch(buildMacroOverview([policyRate], []));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(container.textContent).toMatch(/Europäische Zentralbank/));
    // Die Lizenz der EZB verlangt die Quellenangabe. Sie ist keine Zierde.
    expect(container.textContent ?? "").toMatch(/Keine Anlageberatung/);
  });
});
