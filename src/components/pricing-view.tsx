"use client";

import type { Session } from "@supabase/supabase-js";
import { BriefcaseBusiness, Check, Crown, Lock, RefreshCw, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createCheckoutSession,
  createPortalSession,
  fetchBillingEntitlements,
  type BillingApiResponse
} from "@/lib/billing/client";
import {
  billingGateStatus,
  featureDefinitions,
  getPricingTier,
  pricingTiers,
  type FeatureGateStatus,
  type PaidPlanId,
  type PlanId
} from "@/lib/feature-gates";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const tierIcons: Record<PlanId, typeof Shield> = {
  free: Shield,
  pro: BriefcaseBusiness,
  premium: Crown
};

const statusCopy: Record<FeatureGateStatus, { label: string; tone: string; icon: typeof Check }> = {
  included: { label: "enthalten", tone: "border-profit/30 bg-profit/10 text-profit", icon: Check },
  demo: { label: "vorbereitet", tone: "border-amber/30 bg-amber/10 text-amber", icon: Shield },
  locked: { label: "nicht enthalten", tone: "border-stroke bg-coal text-muted", icon: Lock },
  not_available: { label: "nicht verfügbar", tone: "border-stroke bg-coal text-muted", icon: Lock }
};

const planRecommendations = [
  ["Free", "Für Beobachten, Lernen und erste Analysen mit bewusst kleinen Limits."],
  ["Pro", "Für aktive Nutzer mit Profi-Terminal, mehr Portfolios und höheren Quoten."],
  ["Premium", "Für Intensivnutzer mit großen Watchlists, mehreren Portfolios und den höchsten Nutzungslimits."]
];

function tierStats(tier: (typeof pricingTiers)[number]) {
  return featureDefinitions.reduce(
    (stats, feature) => {
      const status = tier.featureStatus[feature.id];
      if (status === "included") stats.included += 1;
      if (status === "demo") stats.demo += 1;
      if (status === "locked" || status === "not_available") stats.locked += 1;
      return stats;
    },
    { demo: 0, included: 0, locked: 0 }
  );
}

function checkoutPlan(plan: PlanId): plan is PaidPlanId {
  return plan === "pro" || plan === "premium";
}

/** Buchbar heisst: mindestens ein Abrechnungszeitraum hat einen Preis in Stripe. */
function isBookable(plan: PlanId, billing: BillingApiResponse | null) {
  if (!billing || !checkoutPlan(plan)) return false;
  const intervals = billing.billing.plans[plan];
  return Boolean(intervals && (intervals.month || intervals.year));
}

function actionLabel(tierId: PlanId, billing: BillingApiResponse | null, hasSession: boolean) {
  if (!billing) return "Status wird geprüft";
  if (tierId === "free") return billing.plan === "free" ? "Aktueller Tarif" : "Free verfügbar";
  if (billing.billingActive) return "Abo sicher verwalten";
  if (!isBookable(tierId, billing)) return "Checkout nicht konfiguriert";
  if (!hasSession) return "Anmelden zum Upgrade";
  return `${getPricingTier(tierId).name} auswählen`;
}

export function PricingView() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [billing, setBilling] = useState<BillingApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    const load = async (nextSession: Session | null) => {
      if (!disposed) {
        setSession(nextSession);
        setLoading(true);
      }
      try {
        const nextBilling = await fetchBillingEntitlements(nextSession?.access_token);
        if (!disposed) setBilling(nextBilling);
      } catch {
        if (!disposed) setMessage("Billingstatus konnte nicht sicher geladen werden. Alle Upgrades bleiben deaktiviert.");
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    if (!supabase) {
      void load(null);
      return () => {
        disposed = true;
      };
    }

    void supabase.auth.getSession().then(({ data }) => load(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void load(nextSession), 0);
    });

    return () => {
      disposed = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handlePlanAction(plan: PlanId) {
    if (!billing || !checkoutPlan(plan)) return;
    if (!session) {
      window.location.assign("/settings?next=pricing");
      return;
    }

    setBusyPlan(plan);
    setMessage("");
    try {
      const url = billing.billingActive
        ? await createPortalSession(session.access_token)
        : await createCheckoutSession(session.access_token, plan);
      window.location.assign(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing-Aktion konnte nicht ausgeführt werden.");
      setBusyPlan(null);
    }
  }

  const billingConfigured = billing?.billing.configured === true;

  return (
    <div className="space-y-7">
      <section className="rounded-[1.6rem] border border-cyan/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_34%),linear-gradient(145deg,#101712,#050706_72%)] p-5 shadow-panel sm:p-7">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Serverseitige SaaS-Gates</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Tarife mit verifiziertem Zugriffsstatus.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">{billingGateStatus.explanation}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${billingConfigured ? "border-profit/30 bg-profit/10 text-profit" : "border-amber/30 bg-amber/10 text-amber"}`}>
            {loading ? "Billingstatus wird geprüft" : billingConfigured ? "Billing-Backend konfiguriert" : "Billing sicher deaktiviert"}
          </span>
          <span className="rounded-2xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">
            Aktuell: {billing?.plan ?? "free"} · {billing?.status ?? "demo"}
          </span>
          {billing?.cancelAtPeriodEnd ? (
            <span className="rounded-2xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">Kündigung zum Periodenende vorgemerkt</span>
          ) : null}
        </div>
        {message ? <p className="mt-4 rounded-2xl border border-loss/30 bg-loss/10 p-3 text-sm text-loss" role="alert">{message}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[1.3rem] border border-profit/20 bg-profit/10 p-4">
          <Check className="h-5 w-5 text-profit" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Provider statt Client-Vertrauen</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Plan und Laufzeit stammen aus signierten Webhooks und privaten Supabase-Daten.</p>
        </article>
        <article className="rounded-[1.3rem] border border-cyan/20 bg-cyan/10 p-4">
          <Shield className="h-5 w-5 text-cyan" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Limits im Backend</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Watchlists, Alerts und Portfolio-Books werden zusätzlich durch Datenbank-Trigger begrenzt.</p>
        </article>
        <article className="rounded-[1.3rem] border border-amber/20 bg-amber/10 p-4">
          <Lock className="h-5 w-5 text-amber" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Fail-closed</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Fehlende Keys, abgelaufene Perioden oder Zahlfehler schalten keine Pro-Funktion frei.</p>
        </article>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-5">
        <h2 className="text-xl font-semibold text-mist">Welche Stufe passt zu welchem Nutzer?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Die Einordnung beschreibt Funktionsumfang und Limits, niemals eine Renditeerwartung.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {planRecommendations.map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-cyan">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {pricingTiers.map((tier) => {
          const Icon = tierIcons[tier.id];
          const stats = tierStats(tier);
          const configured = isBookable(tier.id, billing ?? null);
          const disabled =
            loading ||
            busyPlan !== null ||
            tier.id === "free" ||
            (!billing?.billingActive && !configured);

          return (
            <article key={tier.name} className={`rounded-[1.3rem] border bg-panel p-5 shadow-panel ${billing?.plan === tier.id ? "border-cyan/55" : "border-stroke"}`}>
              <Icon className="h-6 w-6 text-cyan" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{tier.name}</h2>
                  <p className="mt-1 text-sm text-muted">{tier.audience}</p>
                </div>
                {billing?.plan === tier.id ? <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase text-cyan">aktuell</span> : null}
              </div>
              <p className="mt-4 font-mono text-3xl font-semibold text-mist">{tier.pricing.monthly}</p>
              {tier.pricing.yearly ? (
                <p className="mt-1 text-xs text-muted">
                  oder {tier.pricing.yearly}
                  {tier.pricing.yearlySavingsNote ? ` — ${tier.pricing.yearlySavingsNote}` : ""}
                </p>
              ) : null}
              <p className="mt-3 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs leading-5 text-muted">{tier.technicalStatus}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-profit/20 bg-profit/10 p-2 text-center"><p className="font-mono text-lg font-semibold text-profit">{stats.included}</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted">enthalten</p></div>
                <div className="rounded-xl border border-amber/20 bg-amber/10 p-2 text-center"><p className="font-mono text-lg font-semibold text-amber">{stats.demo}</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted">vorbereitet</p></div>
                <div className="rounded-xl border border-stroke bg-coal p-2 text-center"><p className="font-mono text-lg font-semibold text-muted">{stats.locked}</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted">nicht enthalten</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-stroke bg-coal/65 p-3 text-xs leading-5 text-muted">
                {tier.limits.maxWatchlistItems} Watchlist-Werte · {tier.limits.maxAlerts} Alerts · {tier.limits.portfolios} Portfolio{tier.limits.portfolios === 1 ? "" : "s"} · {tier.limits.historicalDataYears} Jahre Historie
              </div>
              <div className="mt-5 space-y-2">
                {featureDefinitions.map((feature) => {
                  const copy = statusCopy[tier.featureStatus[feature.id]];
                  const StatusIcon = copy.icon;
                  return (
                    <div key={feature.id} className="rounded-xl border border-stroke bg-coal/55 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-mist">{feature.label}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${copy.tone}`}><StatusIcon className="h-3 w-3" />{copy.label}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void handlePlanAction(tier.id)}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:border-stroke disabled:bg-coal disabled:text-muted"
              >
                {busyPlan === tier.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                {actionLabel(tier.id, billing, Boolean(session))}
              </button>
            </article>
          );
        })}
      </section>

      <section className="rounded-[1.5rem] border border-amber/25 bg-amber/10 p-5">
        <h2 className="text-xl font-semibold text-mist">Vor Aktivierung erforderlich</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Stripe-Testmodus, Price-IDs, Webhook-Secret und Produktions-URL müssen gemeinsam konfiguriert sein. Pro und Premium bleiben bis zur vollständigen Billing-Abnahme technisch gesperrt.</p>
      </section>
    </div>
  );
}
