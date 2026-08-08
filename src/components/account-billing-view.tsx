"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, ExternalLink, FileText, Settings2 } from "lucide-react";
import {
  createCheckoutSession,
  createPortalSession,
  fetchBillingEntitlements,
  type BillingApiResponse
} from "@/lib/billing/client";
import { formatInvoiceAmount, type BillingInvoice, type PaymentMethodSummary } from "@/lib/billing/invoices";
import { getPlanPrice, getPricingTier, paidPlanIds, type BillingInterval, type PaidPlanId } from "@/lib/feature-gates";
import { getSupabaseAccessToken, fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";

/**
 * Account → Billing.
 *
 * §6 verlangt an einer Stelle: aktueller Tarif, Preis, nächste Abrechnung,
 * Zahlungsstatus, Zahlungsmethode, Rechnungen, Upgrade, Downgrade, Kündigung.
 * Bisher lag davon nichts im Produkt — die Abo-Verwaltung war eine
 * Weiterleitung ins Stripe-Portal, und Rechnungen gab es gar nicht.
 *
 * Up- und Downgrade sowie die Kündigung laufen weiterhin über das
 * Kundenportal. Das ist Absicht: dort liegen Zahlungsmittel, anteilige
 * Verrechnung und Widerruf bereits rechtssicher gelöst. Nachgebaut würde das
 * fehleranfällig, ohne dem Nutzer etwas zu geben.
 */

type InvoiceResponse = {
  invoices: BillingInvoice[];
  paymentMethod: PaymentMethodSummary | null;
  hasCustomer: boolean;
  note?: string;
};

type State =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "ready"; billing: BillingApiResponse; invoices: InvoiceResponse | null; invoiceError: string | null }
  | { status: "failed"; message: string };

const statusLabels: Record<string, string> = {
  demo: "Kein Abo",
  active: "Aktiv",
  trialing: "Testphase",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
  expired: "Abgelaufen",
  incomplete: "Unvollständig",
  unpaid: "Unbezahlt",
  paused: "Pausiert"
};

const statusTone: Record<string, string> = {
  active: "border-profit/30 bg-profit/10 text-profit",
  trialing: "border-cyan/30 bg-cyan/10 text-cyan",
  past_due: "border-loss/30 bg-loss/10 text-loss",
  unpaid: "border-loss/30 bg-loss/10 text-loss",
  incomplete: "border-amber/30 bg-amber/10 text-amber",
  canceled: "border-amber/30 bg-amber/10 text-amber",
  expired: "border-amber/30 bg-amber/10 text-amber"
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("de-DE");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-mist">{value}</dd>
    </div>
  );
}

export function AccountBillingView() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getSupabaseAccessToken();
    if (!token) {
      setState({ status: "anonymous" });
      return;
    }

    try {
      const billing = await fetchBillingEntitlements(token);
      let invoices: InvoiceResponse | null = null;
      let invoiceError: string | null = null;

      try {
        const response = await fetchWithSupabaseAuth("/api/billing/invoices", { cache: "no-store" });
        if (response.ok) {
          invoices = (await response.json()) as InvoiceResponse;
        } else {
          // Der Tarifteil bleibt nutzbar, auch wenn die Rechnungen fehlen. Was
          // fehlt, wird benannt statt als leere Liste dargestellt.
          invoiceError = "Rechnungen konnten nicht geladen werden.";
        }
      } catch {
        invoiceError = "Rechnungen konnten nicht geladen werden.";
      }

      setState({ status: "ready", billing, invoices, invoiceError });
    } catch {
      setState({ status: "failed", message: "Der Abrechnungsstatus konnte nicht sicher geladen werden." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPortal() {
    setActionError(null);
    setBusy(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Keine Sitzung.");
      window.location.href = await createPortalSession(token);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Das Kundenportal ist nicht erreichbar.");
      setBusy(false);
    }
  }

  async function startCheckout(plan: PaidPlanId, interval: BillingInterval) {
    setActionError(null);
    setBusy(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Keine Sitzung.");
      window.location.href = await createCheckoutSession(token, plan, interval);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Der Checkout ist nicht erreichbar.");
      setBusy(false);
    }
  }

  if (state.status === "loading") {
    return (
      <section className="rounded-3xl border border-stroke bg-panel p-5" aria-busy="true">
        <p className="text-sm text-muted">Abrechnungsdaten werden geladen …</p>
      </section>
    );
  }

  if (state.status === "anonymous") {
    return (
      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <h1 className="text-lg font-semibold text-mist">Abrechnung</h1>
        <p className="mt-1 text-sm text-muted">
          Tarif, Rechnungen und Zahlungsmethode gehören zu einem Konto. Bitte melde dich an.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-stroke bg-coal px-4 py-2 text-sm font-semibold text-mist transition hover:border-cyan/30 hover:text-cyan"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Zur Anmeldung
        </Link>
      </section>
    );
  }

  if (state.status === "failed") {
    return (
      <section className="rounded-3xl border border-loss/25 bg-loss/10 p-5">
        <h1 className="text-lg font-semibold text-mist">Abrechnung nicht verfügbar</h1>
        <p className="mt-1 text-sm text-loss">{state.message}</p>
      </section>
    );
  }

  const { billing, invoices, invoiceError } = state;
  const tier = getPricingTier(billing.plan);
  const paymentTrouble = billing.status === "past_due" || billing.status === "unpaid";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Konto</p>
        <h1 className="mt-1 text-lg font-semibold text-mist">Abrechnung</h1>
      </header>

      {paymentTrouble ? (
        <section className="rounded-3xl border border-loss/25 bg-loss/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-mist">Eine Zahlung ist offen</h2>
              <p className="mt-1 text-sm text-loss">
                Solange die Zahlung offen ist, bleiben kostenpflichtige Funktionen gesperrt. Im Kundenportal
                lässt sich die Zahlungsmethode aktualisieren.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Aktueller Tarif</h2>
            <p className="mt-1 text-2xl font-semibold text-mist">{tier.name}</p>
          </div>
          <span
            className={`rounded-xl border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              statusTone[billing.status] ?? "border-stroke bg-coal text-muted"
            }`}
          >
            {statusLabels[billing.status] ?? billing.status}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Preis" value={tier.price} />
          <Field
            label={billing.cancelAtPeriodEnd ? "Zugang bis" : "Nächste Abrechnung"}
            value={formatDate(billing.validUntil)}
          />
          <Field
            label="Zahlungsmethode"
            value={
              invoices?.paymentMethod
                ? `${invoices.paymentMethod.brand} ••••${invoices.paymentMethod.last4}${
                    invoices.paymentMethod.expiresAt ? ` · ${invoices.paymentMethod.expiresAt}` : ""
                  }`
                : "Keine hinterlegt"
            }
          />
          <Field label="Testphase bis" value={formatDate(billing.trialEndsAt)} />
        </dl>

        {billing.cancelAtPeriodEnd ? (
          <p className="mt-3 rounded-2xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            Die Kündigung ist vorgemerkt. Der Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {billing.canManageBilling ? (
            <button
              type="button"
              onClick={openPortal}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Tarif wechseln, Zahlungsmethode ändern oder kündigen
            </button>
          ) : (
            <>
              {paidPlanIds.flatMap((plan) =>
                (["month", "year"] as const)
                  .filter((interval) => billing.billing.plans[plan]?.[interval])
                  .map((interval) => (
                    <button
                      key={`${plan}-${interval}`}
                      type="button"
                      onClick={() => startCheckout(plan, interval)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
                    >
                      {getPricingTier(plan).name} buchen · {getPlanPrice(plan, interval)}
                    </button>
                  ))
              )}
              {!paidPlanIds.some((plan) => billing.billing.plans[plan]?.month || billing.billing.plans[plan]?.year) ? (
                <p className="text-sm text-muted">
                  Es ist derzeit kein Tarif buchbar, weil die Zahlungsanbindung noch nicht eingerichtet ist.
                </p>
              ) : null}
            </>
          )}
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-2xl border border-stroke bg-coal px-4 py-2 text-sm text-mist transition hover:border-cyan/30 hover:text-cyan"
          >
            Tarife vergleichen
          </Link>
        </div>

        {actionError ? <p className="mt-3 text-sm text-loss">{actionError}</p> : null}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Wechsel, Zahlungsmethode und Kündigung laufen über das Kundenportal von Stripe. Dort sind anteilige
          Verrechnung und Widerruf bereits rechtssicher gelöst — nachgebaut wäre das fehleranfällig, ohne dir
          etwas zu geben.
        </p>
      </section>

      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Rechnungen</h2>

        {invoiceError ? (
          <p className="mt-2 text-sm text-amber">{invoiceError}</p>
        ) : !invoices || invoices.invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {invoices?.note ?? "Für dieses Konto liegen noch keine Rechnungen vor."}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {invoices.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-stroke bg-coal px-3 py-2"
              >
                <span className="font-mono text-xs text-muted">{invoice.number ?? invoice.id}</span>
                <span className="text-xs text-muted">{formatDate(invoice.createdAt)}</span>
                <span className="text-sm font-semibold text-mist">
                  {formatInvoiceAmount(invoice.amountDue, invoice.currency)}
                </span>
                <span
                  className={`rounded-xl border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    invoice.status === "paid"
                      ? "border-profit/30 bg-profit/10 text-profit"
                      : invoice.status === "open"
                        ? "border-amber/30 bg-amber/10 text-amber"
                        : "border-stroke bg-panel text-muted"
                  }`}
                >
                  {invoice.statusLabel}
                </span>
                <span className="ml-auto flex gap-3">
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      PDF
                    </a>
                  ) : null}
                  {invoice.hostedInvoiceUrl ? (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                    >
                      Ansehen
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
