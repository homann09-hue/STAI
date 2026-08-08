import Link from "next/link";
import { CreditCard, Lock, LogIn, ServerCrash, Wrench } from "lucide-react";
import type { FeaturePaywall } from "@/lib/billing/feature-access";

/**
 * Die Ansicht für eine nicht freigeschaltete Funktion.
 *
 * Sie ersetzt das, was vorher passiert wäre: eine rohe Fehlermeldung oder — noch
 * schlechter — die kostenpflichtige Ansicht selbst. §6 des Masterprompts
 * verlangt vier Angaben, und genau die stehen hier: welche Funktion fehlt,
 * welcher Tarif sie enthält, welchen Mehrwert sie hat und wie es weitergeht.
 *
 * Bewusst nicht enthalten: ein Upgrade-Knopf, hinter dem kein Checkout liegt.
 * Ein Knopf, der nichts tut, wäre eine Funktionsattrappe.
 */
export function PaywallNotice({ paywall }: { paywall: FeaturePaywall }) {
  const tone =
    paywall.reason === "plan_upgrade_required"
      ? { border: "border-cyan/25", bg: "bg-cyan/10", text: "text-cyan", Icon: Lock }
      : paywall.reason === "authentication_required"
        ? { border: "border-stroke", bg: "bg-panel", text: "text-mist", Icon: LogIn }
        : paywall.reason === "billing_unverifiable"
          ? { border: "border-loss/25", bg: "bg-loss/10", text: "text-loss", Icon: ServerCrash }
          : { border: "border-amber/25", bg: "bg-amber/10", text: "text-amber", Icon: Wrench };

  const headline =
    paywall.reason === "plan_upgrade_required"
      ? `${paywall.featureLabel} ist im Tarif ${paywall.requiredPlanName ?? "höher"} enthalten`
      : paywall.reason === "authentication_required"
        ? `${paywall.featureLabel} braucht ein Konto`
        : paywall.reason === "billing_unverifiable"
          ? "Tarif lässt sich gerade nicht prüfen"
          : `${paywall.featureLabel} ist noch nicht verfügbar`;

  return (
    <section className={`rounded-3xl border ${tone.border} ${tone.bg} p-5`}>
      <div className="flex items-start gap-3">
        <tone.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} aria-hidden="true" />
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-mist">{headline}</h2>
            <p className={`mt-1 text-sm ${tone.text}`}>{paywall.message}</p>
          </div>

          {paywall.benefit ? (
            <p className="text-sm text-muted">
              <span className="font-semibold text-mist">Was die Funktion leistet:</span> {paywall.benefit}
            </p>
          ) : null}

          {paywall.requiredPlan && paywall.reason === "plan_upgrade_required" ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Dein Tarif</dt>
                <dd className="mt-0.5 text-sm text-mist">{paywall.currentPlanName ?? "Free"}</dd>
              </div>
              <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Enthalten ab</dt>
                <dd className="mt-0.5 text-sm text-mist">
                  {paywall.requiredPlanName}
                  {paywall.requiredPlanPrice ? (
                    <span className="text-muted"> · {paywall.requiredPlanPrice}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : null}

          {paywall.upgradePath ? (
            paywall.checkoutAvailable ? (
              <Link
                href={paywall.upgradePath}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition hover:bg-cyan/20"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Tarife ansehen
              </Link>
            ) : (
              // Der Weg wird genannt, aber nicht als bedienbar dargestellt.
              // Ohne konfigurierten Checkout führt der Knopf ins Leere.
              <p className="text-sm text-muted">
                Der Wechsel ist derzeit nicht buchbar, weil die Zahlungsanbindung für diesen Tarif noch
                nicht eingerichtet ist.{" "}
                <Link href={paywall.upgradePath} className="text-mist underline underline-offset-2">
                  Tarifübersicht
                </Link>
              </p>
            )
          ) : null}

          <p className="text-xs text-muted">
            Es wurden keine Daten dieser Funktion geladen und nichts abgerechnet.
          </p>
        </div>
      </div>
    </section>
  );
}
