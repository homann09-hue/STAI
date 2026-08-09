// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaywallNotice } from "./paywall-notice";
import { evaluateFeatureAccess } from "@/lib/billing/feature-access";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import type { FeaturePaywall } from "@/lib/billing/feature-access";

/**
 * Diese Ansicht ist der einzige Ort, an dem StockPilot einem Nutzer sagt, dass
 * er für etwas zahlen soll. Die Tests prüfen deshalb nicht das Layout, sondern
 * ob die vier Angaben aus §6 tatsächlich vor dem Nutzer stehen — und ob kein
 * Knopf angeboten wird, der nichts bewirkt.
 */

// Vitest laeuft hier ohne `globals`, deshalb raeumt Testing Library nicht
// automatisch auf.
afterEach(cleanup);

function paywallFor(
  feature: Parameters<typeof evaluateFeatureAccess>[0],
  input: Parameters<typeof evaluateFeatureAccess>[1]
): FeaturePaywall {
  const decision = evaluateFeatureAccess(feature, input);
  if (decision.allowed) throw new Error("Test erwartet eine Ablehnung");
  return decision.paywall;
}

const freeAccount = resolveEntitlements(
  { plan: "free", status: "demo", provider: "none" },
  { billingConfigured: true }
);

function text(container: HTMLElement) {
  return container.textContent ?? "";
}

describe("PaywallNotice", () => {
  it("nennt Funktion, Mehrwert, Tarif und Preis", () => {
    const { container } = render(
      <PaywallNotice
        paywall={paywallFor("pro_terminal", {
          entitlements: freeAccount,
          authenticated: true,
          checkoutAvailable: true
        })}
      />
    );

    const visible = text(container);
    expect(visible).toMatch(/Profi-Terminal/);
    expect(visible).toMatch(/Was die Funktion leistet/);
    expect(visible).toMatch(/Pro/);
    expect(visible).toMatch(/29,99 € \/ Monat/);
    expect(screen.getByRole("link", { name: /Tarife ansehen/i })).toBeTruthy();
  });

  it("zeigt keinen Buchungsknopf ohne konfigurierten Checkout", () => {
    const { container } = render(
      <PaywallNotice
        paywall={paywallFor("pro_terminal", {
          entitlements: freeAccount,
          authenticated: true,
          checkoutAvailable: false
        })}
      />
    );

    // Ein Knopf, hinter dem kein Checkout liegt, waere eine Funktionsattrappe.
    expect(screen.queryByRole("link", { name: /Tarife ansehen/i })).toBeNull();
    expect(text(container)).toMatch(/nicht buchbar/i);
  });

  it("fordert bei fehlendem Konto zur Anmeldung auf, nicht zur Zahlung", () => {
    const { container } = render(
      <PaywallNotice paywall={paywallFor("pro_terminal", { entitlements: null, authenticated: false })} />
    );

    expect(text(container)).toMatch(/braucht ein Konto/i);
    // Ein „bitte anmelden" ohne Weg dorthin waere eine Sackgasse. StockPilot
    // hat keine Loginseite, die Anmeldung sitzt in den Einstellungen.
    const signIn = screen.getByRole("link", { name: /Zur Anmeldung/i });
    expect(signIn.getAttribute("href")).toBe("/settings");
    // Und kein Kaufangebot, solange gar kein Konto existiert.
    expect(screen.queryByRole("link", { name: /Tarife ansehen/i })).toBeNull();
  });

  it("unterstellt bei unlesbarem Billingstatus keinen zu kleinen Tarif", () => {
    const degraded = resolveEntitlements(null, {
      billingConfigured: true,
      degraded: true,
      reason: "entitlements_unavailable"
    });
    const { container } = render(
      <PaywallNotice paywall={paywallFor("pro_terminal", { entitlements: degraded, authenticated: true })} />
    );

    const visible = text(container);
    expect(visible).toMatch(/nicht sicher prüfen|nicht prüfen/i);
    // Weder Preis noch Upgrade-Aufforderung: wir wissen nicht, ob Zahlen hilft.
    expect(visible).not.toMatch(/29,99 €/);
    expect(screen.queryByRole("link", { name: /Tarife ansehen/i })).toBeNull();
  });

  it("verkauft keine Funktion, die kein Tarif enthält", () => {
    const { container } = render(
      <PaywallNotice paywall={paywallFor("exports", { entitlements: freeAccount, authenticated: true })} />
    );

    const visible = text(container);
    expect(visible).toMatch(/noch nicht verfügbar/i);
    expect(screen.queryByRole("link", { name: /Tarife ansehen/i })).toBeNull();
  });

  it("sagt in jedem Fall zu, dass nichts geladen und nichts abgerechnet wurde", () => {
    for (const paywall of [
      paywallFor("pro_terminal", { entitlements: freeAccount, authenticated: true }),
      paywallFor("pro_terminal", { entitlements: null, authenticated: false }),
      paywallFor("exports", { entitlements: freeAccount, authenticated: true })
    ]) {
      const { container } = render(<PaywallNotice paywall={paywall} />);
      expect(text(container)).toMatch(/nichts abgerechnet/i);
      cleanup();
    }
  });
});
