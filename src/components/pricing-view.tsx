"use client";

import { BriefcaseBusiness, Check, Crown, Lock, Rocket, Shield } from "lucide-react";
import { billingGateStatus, featureDefinitions, pricingTiers, type FeatureGateStatus, type PlanId } from "@/lib/feature-gates";

const tierIcons: Record<PlanId, typeof Shield> = {
  free: Shield,
  starter: Rocket,
  pro: BriefcaseBusiness,
  elite: Crown
};

const statusCopy: Record<FeatureGateStatus, { label: string; tone: string; icon: typeof Check }> = {
  included: { label: "aktiv", tone: "border-profit/30 bg-profit/10 text-profit", icon: Check },
  demo: { label: "Demo / nicht freigeschaltet", tone: "border-amber/30 bg-amber/10 text-amber", icon: Shield },
  locked: { label: "gesperrt", tone: "border-stroke bg-coal text-muted", icon: Lock },
  not_available: { label: "nicht verfügbar", tone: "border-stroke bg-coal text-muted", icon: Lock }
};

export function PricingView() {
  return (
    <div className="space-y-7">
      <section className="rounded-[1.6rem] border border-amber/20 bg-[radial-gradient(circle_at_top_right,rgba(245,201,107,0.14),transparent_34%),linear-gradient(145deg,#101712,#050706_72%)] p-5 shadow-panel sm:p-7">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Feature-Gates vorbereitet</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Preisstruktur mit ehrlichem Gate-Status.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          {billingGateStatus.explanation} Die UI zeigt deshalb klar, welche Funktionen aktiv,
          nur als Demo vorhanden oder noch gesperrt sind.
        </p>
        <p className="mt-4 inline-flex rounded-2xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs font-semibold text-amber">
          {billingGateStatus.label}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {pricingTiers.map((tier) => {
          const Icon = tierIcons[tier.id];

          return (
            <article key={tier.name} className="rounded-[1.3rem] border border-stroke bg-panel p-5 shadow-panel">
              <Icon className="h-6 w-6 text-cyan" />
              <h2 className="mt-4 text-xl font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-muted">{tier.audience}</p>
              {tier.id === "pro" ? (
                <p className="mt-3 inline-flex rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
                  mehrere Portfolios
                </p>
              ) : null}
              <p className="mt-4 font-mono text-3xl font-semibold text-mist">{tier.price}</p>
              <p className="mt-3 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">{tier.technicalStatus}</p>
              <div className="mt-5 space-y-2">
                {featureDefinitions.map((feature) => {
                  const status = tier.featureStatus[feature.id];
                  const copy = statusCopy[status];
                  const StatusIcon = copy.icon;

                  return (
                    <div key={feature.id} className="rounded-xl border border-stroke bg-coal/55 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-mist">{feature.label}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${copy.tone}`}>
                          <StatusIcon className="h-3 w-3" />
                          {copy.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled
                className="mt-5 h-11 w-full cursor-not-allowed rounded-xl border border-stroke bg-coal px-4 text-sm font-semibold text-muted"
              >
                Billing noch nicht aktiv
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
