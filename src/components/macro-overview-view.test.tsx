// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MacroOverviewView } from "./macro-overview-view";
import { buildMacroOverview, buildMacroReading } from "@/lib/macro/analysis";
import { findMacroSeries } from "@/lib/macro/series";
import { findFredSeries } from "@/lib/macro/fred";
import { toMacroReadingSource } from "@/lib/macro/fred-reading";

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

function fredReading(id: string, period: string, value: number) {
  const definition = findFredSeries(id);
  if (!definition) throw new Error(`FRED-Reihe ${id} fehlt`);
  const result = buildMacroReading(toMacroReadingSource(definition), [{ period, value }], now);
  if (!result) throw new Error(`FRED-Reihe ${id} lieferte keinen Wert`);
  return result;
}

const usReading = () => fredReading("us_yield_10y", "2026-08-06", 4.69);
const retailReading = () => fredReading("us_retail_sales", "2026-06-01", 768_553);

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

describe("Wirtschaftsräume", () => {
  it("fragt den Euroraum zuerst und wechselt auf Zuruf", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          json: async () =>
            url.includes("region=us")
              ? buildMacroOverview([usReading()], [], null, {
                  shortEndId: "us_yield_3m",
                  longEndId: "us_yield_10y",
                  disclaimer: "US-Makrodaten stammen von FRED."
                })
              : buildMacroOverview([reading("ea_policy_rate", "2026-08-08", 2.4)], [])
        };
      }) as unknown as typeof fetch
    );

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(container.textContent).toMatch(/EZB-Leitzins/));
    expect(calls).toEqual(["/api/macro?region=euro_area"]);

    fireEvent.click(screen.getByRole("tab", { name: "USA" }));

    await waitFor(() => expect(container.textContent).toMatch(/US-Rendite 10 Jahre/));
    expect(calls).toContain("/api/macro?region=us");

    // Der entscheidende Punkt: nach dem Wechsel steht keine Zahl des anderen
    // Raums mehr da. Eine Inflationsrate ohne Angabe, wo sie gilt, ist
    // schlimmer als gar keine.
    expect(container.textContent ?? "").not.toMatch(/EZB-Leitzins/);
    expect(container.textContent ?? "").toMatch(/Federal Reserve Bank of St. Louis/);
  });

  it("holt einen bereits geladenen Raum nicht erneut", async () => {
    // Beide Quellen sind kostenlos und oeffentlich. Sie bei jedem Klick erneut
    // zu belasten waere schlechtes Benehmen, kein Kostenproblem.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => buildMacroOverview([reading("ea_policy_rate", "2026-08-08", 2.4)], [])
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<MacroOverviewView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "USA" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("tab", { name: "Euroraum" }));
    fireEvent.click(screen.getByRole("tab", { name: "USA" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("zeigt die Größenordnung, ohne die der Wert falsch wäre", async () => {
    // 768553 sind Millionen Dollar. Ohne den Zusatz laege die Anzeige um den
    // Faktor eine Million daneben -- und saehe dabei plausibel aus.
    stubFetch(buildMacroOverview([retailReading()], []));

    const { container } = render(<MacroOverviewView />);

    await waitFor(() => expect(container.textContent).toMatch(/Einzelhandelsumsätze/));
    expect(container.textContent ?? "").toMatch(/768\.553,00 Mio\. \$/);
  });

  it("zeigt Beobachtung, Erstveröffentlichung und Revision getrennt", async () => {
    const value = {
      ...usReading(),
      dataLifecycle: {
        observationDate: "2026-08-06",
        firstPublishedAt: "2026-08-07",
        vintageAsOf: "2026-08-17",
        revisionStatus: "revised" as const,
        initialValue: 4.68,
        revisionDelta: 0.01
      }
    };
    stubFetch(buildMacroOverview([value], []));

    const { container } = render(<MacroOverviewView />);
    await waitFor(() => expect(container.textContent).toMatch(/US-Rendite 10 Jahre/));
    const visible = container.textContent ?? "";
    expect(visible).toMatch(/Erstveröffentlichung 2026-08-07/);
    expect(visible).toMatch(/Vintage geprüft bis 2026-08-17/);
    expect(visible).toMatch(/Revidiert/);
  });
});
