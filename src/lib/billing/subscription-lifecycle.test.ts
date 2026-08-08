import { describe, expect, it } from "vitest";
import { resolveEntitlements, type EntitlementRecordInput } from "@/lib/billing/entitlements";
import { evaluateFeatureAccess } from "@/lib/billing/feature-access";

/**
 * §19: Produktionsreife ist ein Testziel.
 *
 * Diese Datei prüft nicht „funktioniert der Code", sondern „kann ein echter
 * zahlender Nutzer das Produkt sinnvoll verwenden". Sie bildet die vier
 * Nutzerflüsse aus der Zieldefinition als Zustandsfolgen ab — Kündigung,
 * fehlgeschlagene Zahlung, Upgrade, Ablauf.
 *
 * Das ist der Teil, der ohne Stripe-Konto deterministisch prüfbar ist. Was
 * daran hängt und hier **nicht** geprüft werden kann, steht am Ende der Datei
 * benannt statt stillschweigend zu fehlen.
 */

const NOW = Date.parse("2026-08-08T12:00:00.000Z");
const IN_TEN_DAYS = new Date(NOW + 10 * 86_400_000).toISOString();
const YESTERDAY = new Date(NOW - 86_400_000).toISOString();

function account(overrides: EntitlementRecordInput = {}) {
  return resolveEntitlements(
    {
      plan: "pro",
      status: "active",
      provider: "stripe",
      provider_customer_id: "cus_00000000000000",
      provider_subscription_id: "sub_00000000000000",
      valid_until: IN_TEN_DAYS,
      ...overrides
    },
    { billingConfigured: true, now: NOW }
  );
}

/** Kurzform: darf dieses Konto das Profi-Terminal öffnen? */
function canUseProTerminal(entitlements: ReturnType<typeof resolveEntitlements>) {
  return evaluateFeatureAccess("pro_terminal", { entitlements, authenticated: true }).allowed;
}

describe("Fluss: Kündigung", () => {
  it("lässt den Zugang bis zum Ende des bezahlten Zeitraums bestehen", () => {
    // Nach der Kuendigung im Kundenportal bleibt der Status `active`, Stripe
    // setzt `cancel_at_period_end`. Wer bis zum Monatsende bezahlt hat, muss
    // bis dahin auch nutzen duerfen -- alles andere waere Diebstahl.
    const cancelled = account({ cancel_at_period_end: true });

    expect(cancelled.plan).toBe("pro");
    expect(cancelled.billingActive).toBe(true);
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(canUseProTerminal(cancelled)).toBe(true);
  });

  it("entzieht den Zugang genau dann, wenn der Zeitraum abgelaufen ist", () => {
    const expired = account({ cancel_at_period_end: true, valid_until: YESTERDAY });

    expect(expired.status).toBe("expired");
    expect(expired.plan).toBe("free");
    expect(canUseProTerminal(expired)).toBe(false);
  });

  it("nennt dem Nutzer den Zeitpunkt, bis zu dem er noch Zugang hat", () => {
    // Ohne dieses Datum kann `/account/billing` nicht sagen "Zugang bis X" --
    // und der Nutzer weiss nicht, woran er ist.
    const cancelled = account({ cancel_at_period_end: true });
    expect(cancelled.validUntil).toBe(IN_TEN_DAYS);
  });
});

describe("Fluss: fehlgeschlagene Zahlung", () => {
  it("schaltet bei überfälliger Zahlung keine Bezahlfunktion frei", () => {
    // Der gefaehrlichste Fall: eine fehlgeschlagene Zahlung darf niemals wie
    // eine erfolgreiche wirken.
    const pastDue = account({ status: "past_due" });

    expect(pastDue.billingActive).toBe(false);
    expect(pastDue.plan).toBe("free");
    expect(canUseProTerminal(pastDue)).toBe(false);
  });

  it("behält den Status, damit die Oberfläche den Grund nennen kann", () => {
    // Der Tarif faellt auf free, der Status bleibt `past_due`. Nur so kann
    // /account/billing "Eine Zahlung ist offen" statt "Kein Abo" zeigen --
    // der Unterschied entscheidet, ob der Nutzer handeln kann.
    const pastDue = account({ status: "past_due" });

    expect(pastDue.status).toBe("past_due");
    expect(pastDue.plan).toBe("free");
  });

  it("behandelt auch `unpaid` und `incomplete` als nicht freigeschaltet", () => {
    for (const status of ["unpaid", "incomplete", "canceled", "paused"] as const) {
      const blocked = account({ status });
      expect(blocked.billingActive).toBe(false);
      expect(canUseProTerminal(blocked)).toBe(false);
    }
  });

  it("erlaubt weiterhin die Verwaltung, damit der Nutzer die Karte tauschen kann", () => {
    // Waere das Kundenportal bei `past_due` gesperrt, saesse der Nutzer in
    // einer Falle: er koennte die fehlgeschlagene Zahlung nicht reparieren.
    const pastDue = account({ status: "past_due" });
    expect(pastDue.providerCustomerId).toBe("cus_00000000000000");
  });
});

describe("Fluss: Upgrade", () => {
  it("gibt die Funktion sofort frei, sobald das Abo aktiv ist", () => {
    const free = resolveEntitlements(
      { plan: "free", status: "demo", provider: "none" },
      { billingConfigured: true, now: NOW }
    );
    expect(canUseProTerminal(free)).toBe(false);

    // Nach dem Webhook: derselbe Nutzer, neuer Datensatz.
    expect(canUseProTerminal(account())).toBe(true);
  });

  it("gibt während der Testphase frei", () => {
    const trialing = account({ status: "trialing", trial_ends_at: IN_TEN_DAYS });

    expect(trialing.billingActive).toBe(true);
    expect(canUseProTerminal(trialing)).toBe(true);
    expect(trialing.trialEndsAt).toBe(IN_TEN_DAYS);
  });

  it("schaltet Premium-Funktionen erst im Premium-Tarif frei", () => {
    const pro = account({ plan: "pro" });
    const premium = account({ plan: "premium" });

    expect(evaluateFeatureAccess("portfolio_risk", { entitlements: pro, authenticated: true }).allowed).toBe(false);
    expect(evaluateFeatureAccess("portfolio_risk", { entitlements: premium, authenticated: true }).allowed).toBe(
      true
    );
  });
});

describe("Fluss: manipulierte oder unvollständige Daten", () => {
  it("gibt ohne Gültigkeitsdatum nichts frei", () => {
    // Ein Stripe-Abo ohne Periodenende ist kein bezahltes Abo. Ohne diese
    // Bedingung wuerde ein halb geschriebener Datensatz dauerhaft freischalten.
    const noExpiry = account({ valid_until: null });

    expect(noExpiry.billingActive).toBe(false);
    expect(canUseProTerminal(noExpiry)).toBe(false);
  });

  it("gibt ohne konfiguriertes Billing nichts frei", () => {
    const unconfigured = resolveEntitlements(
      {
        plan: "premium",
        status: "active",
        provider: "stripe",
        provider_customer_id: "cus_00000000000000",
        valid_until: IN_TEN_DAYS
      },
      { billingConfigured: false, now: NOW }
    );

    // Fail closed: ohne verifizierbares Billing ist ein "aktives" Abo eine
    // unbelegte Behauptung.
    expect(unconfigured.billingActive).toBe(false);
    expect(unconfigured.plan).toBe("free");
  });

  it("akzeptiert keinen erfundenen Zahlungsanbieter", () => {
    const fake = account({ provider: "selbstgebaut" });

    expect(fake.billingActive).toBe(false);
    expect(canUseProTerminal(fake)).toBe(false);
  });

  it("erlaubt die manuelle Freigabe nur ohne Ablauf in der Vergangenheit", () => {
    // `manual` deckt Vertragskunden ab. Auch dort gilt: abgelaufen ist
    // abgelaufen.
    const manual = account({ provider: "manual", provider_customer_id: null });
    const manualExpired = account({ provider: "manual", provider_customer_id: null, valid_until: YESTERDAY });

    expect(manual.billingActive).toBe(true);
    expect(manualExpired.billingActive).toBe(false);
  });
});

describe("Fluss: Neukunde ohne Zahlung", () => {
  it("bekommt einen nutzbaren Free-Tarif statt einer Fehlermeldung", () => {
    const newUser = resolveEntitlements(null, { billingConfigured: true, now: NOW });

    expect(newUser.plan).toBe("free");
    expect(newUser.status).toBe("demo");
    // Free muss echten Nutzen liefern -- die Assetanalyse gehoert dazu.
    expect(evaluateFeatureAccess("asset_analysis", { entitlements: newUser, authenticated: true }).allowed).toBe(
      true
    );
    expect(evaluateFeatureAccess("watchlist", { entitlements: newUser, authenticated: true }).allowed).toBe(true);
  });

  it("sieht bei einer Bezahlfunktion eine Paywall mit Tarif und Preis", () => {
    const newUser = resolveEntitlements(null, { billingConfigured: true, now: NOW });
    const decision = evaluateFeatureAccess("pro_terminal", {
      entitlements: newUser,
      authenticated: true,
      checkoutAvailable: true
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.paywall.requiredPlan).toBe("pro");
    expect(decision.paywall.requiredPlanPrice).toBe("29,99 € / Monat");
  });
});

/**
 * Was diese Datei **nicht** prüft, und warum:
 *
 * Registrierung, Login, Checkout-Weiterleitung und die Zustellung des
 * Stripe-Webhooks brauchen ein echtes Stripe-Konto mit konfigurierten
 * Preis-IDs und einen laufenden Server. Sie sind Teil des Launch-Checks nach
 * §110 und stehen dort als offen -- nicht hier als erledigt.
 *
 * Geprüft ist damit die Kette vom Webhook-Datensatz bis zur Freigabe. Ungeprüft
 * bleibt die Kette davor: von der Zahlung bis zum Datensatz.
 */
