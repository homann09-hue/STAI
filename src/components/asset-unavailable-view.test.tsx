// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssetUnavailableView } from "./asset-unavailable-view";
import { resolveAssetUnavailability } from "@/lib/asset-availability";
import type { KnownInstrumentIdentity } from "@/lib/asset-availability";

/**
 * Diese Ansicht existiert, weil ein pauschales „Asset nicht gefunden" bei einem
 * real existierenden Instrument eine falsche Auskunft ist. Die Tests prüfen
 * genau das: dass der angezeigte Grund zum tatsächlichen Grund passt.
 */

function identity(overrides: Partial<KnownInstrumentIdentity> = {}): KnownInstrumentIdentity {
  return {
    internalInstrumentId: "11111111-1111-4111-8111-111111111111",
    canonicalId: "etf:xnas:qqq:usd",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    assetClass: "etf",
    exchange: "NASDAQ",
    exchangeCode: "NASDAQ",
    mic: "XNAS",
    currency: "USD",
    provider: "FMP",
    quoteStatus: "restricted",
    ...overrides
  };
}

function renderFor(symbol: string, known: KnownInstrumentIdentity | null) {
  return render(
    <AssetUnavailableView symbol={symbol} unavailability={resolveAssetUnavailability({ symbol, known })} />
  );
}

function visibleText(container: HTMLElement) {
  return container.textContent ?? "";
}

// Vitest laeuft hier ohne `globals`, deshalb raeumt Testing Library nicht
// automatisch auf. Ohne diesen Aufruf sammeln sich die Renders im selben
// Dokument und `screen`-Abfragen finden Treffer aus vorherigen Tests.
afterEach(cleanup);

describe("AssetUnavailableView", () => {
  it("sagt bei einem gesperrten Instrument nicht, es sei nicht gefunden", () => {
    const { container } = renderFor("QQQ", identity());

    expect(visibleText(container)).not.toMatch(/nicht gefunden/i);
    expect(screen.getByText(/Daten nicht freigeschaltet/i)).toBeTruthy();
  });

  it("zeigt die bekannten Stammdaten, statt den Nutzer im Leeren zu lassen", () => {
    const { container } = renderFor("QQQ", identity());
    const text = visibleText(container);

    for (const value of ["Invesco QQQ Trust", "etf", "NASDAQ", "USD", "FMP"]) {
      expect(text).toContain(value);
    }
  });

  it("stellt klar, dass Kurs- und Analysedaten nicht geschaetzt werden", () => {
    const { container } = renderFor("QQQ", identity());
    expect(visibleText(container)).toMatch(/bewusst nicht geschätzt/i);
  });

  it("nennt bei der Tarifsperre den tatsaechlichen Grund", () => {
    const { container } = renderFor("QQQ", identity());
    expect(visibleText(container)).toMatch(/Providertarif gibt für dieses Symbol keinen Kurs frei/i);
  });

  it("unterscheidet einen voruebergehenden Fehler von einer dauerhaften Sperre", () => {
    const { container } = renderFor("AAPL", identity({ symbol: "AAPL", quoteStatus: "error" }));
    const text = visibleText(container);

    expect(text).toMatch(/gerade nicht möglich/i);
    expect(text).toMatch(/Vorübergehendes Providerproblem/i);
    // Darf nicht wie eine Tarifsperre aussehen.
    expect(text).not.toMatch(/Datentarif nicht abgedeckt/i);
  });

  it("behandelt ein ungepruefes Instrument nicht als gesperrt", () => {
    const { container } = renderFor("MSFT", identity({ symbol: "MSFT", quoteStatus: "unknown" }));
    expect(visibleText(container)).toMatch(/Vorübergehendes Providerproblem/i);
  });

  it("erklaert bei nicht verifizierbarer Identitaet das suchgetriebene Universum", () => {
    const { container } = renderFor("GIBTESNICHT", null);
    const text = visibleText(container);

    expect(text).toMatch(/kein Eintrag im Instrument\s*Master/i);
    expect(text).toMatch(/wächst suchgetrieben/i);
    expect(text).not.toMatch(/Instrument nicht gefunden/i);
  });

  it("bietet immer einen Rueckweg an", () => {
    renderFor("QQQ", identity());
    const link = screen.getByRole("link", { name: /Zurück zu den Märkten/i });

    expect(link.getAttribute("href")).toBe("/markets");
  });

  it("zeigt Mehrfachlistings als auswählbare Handelsplätze", () => {
    const first = identity({ symbol: "ABC", canonicalId: "stock:xnas:abc:usd" });
    const second = identity({
      symbol: "ABC",
      canonicalId: "stock:xetr:abc:eur",
      exchange: "XETRA",
      mic: "XETR",
      currency: "EUR",
    });
    render(
      <AssetUnavailableView
        symbol="ABC"
        unavailability={resolveAssetUnavailability({
          symbol: "ABC",
          known: null,
          ambiguous: [first, second],
        })}
      />,
    );

    expect(screen.getByText(/Handelsplatz auswählen/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /XETRA · EUR · XETR/i }).getAttribute("href")).toContain(
      "canonicalId=stock%3Axetr%3Aabc%3Aeur",
    );
  });
});
