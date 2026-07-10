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

function featureStatusCopy(tier: (typeof pricingTiers)[number], status: FeatureGateStatus) {
  if (tier.billingRequired && !billingGateStatus.active && status === "included") {
    return {
      label: "Basis aktiv / Plan nicht freigeschaltet",
      tone: "border-amber/30 bg-amber/10 text-amber",
      icon: Shield
    };
  }

  return statusCopy[status];
}

const planRecommendations = [
  ["Free", "Für Beobachten, Lernen und erste Watchlist ohne echte Profi-Workflows."],
  ["Starter", "Für kleine Anleger, die Lernbereich, Watchlist und mehr Orientierung wollen."],
  ["Pro", "Für aktive Nutzer mit Portfolio, Alerts, tieferen Analysen und mehr Kontrollbedarf."],
  ["Elite/Business", "Für Teams, Unternehmer und Profis mit Export-, API-, Multi-Portfolio- und Governance-Bedarf."]
];

const backendGateChecklist = [
  ["Auth", "User ist eindeutig angemeldet und Session ist gültig."],
  ["Plan", "Billing-Provider bestätigt aktiven Tarif serverseitig."],
  ["Limits", "Watchlist-, Alert-, Portfolio- und API-Limits werden im Backend erzwungen."],
  ["Audit", "Gate-Entscheidungen sind für Support und Sicherheit nachvollziehbar."]
];

function tierStats(tier: (typeof pricingTiers)[number]) {
  return featureDefinitions.reduce(
    (stats, feature) => {
      const status = tier.featureStatus[feature.id];
      if (status === "included" && !(tier.billingRequired && !billingGateStatus.active)) stats.included += 1;
      if (status === "included" && tier.billingRequired && !billingGateStatus.active) stats.demo += 1;
      if (status === "demo") stats.demo += 1;
      if (status === "locked" || status === "not_available") stats.locked += 1;
      return stats;
    },
    { demo: 0, included: 0, locked: 0 }
  );
}

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

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[1.3rem] border border-profit/20 bg-profit/10 p-4">
          <Check className="h-5 w-5 text-profit" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Aktiv heißt wirklich nutzbar</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Nur Funktionen mit bestätigter technischer Grundlage werden als aktiv dargestellt.
          </p>
        </article>
        <article className="rounded-[1.3rem] border border-amber/20 bg-amber/10 p-4">
          <Shield className="h-5 w-5 text-amber" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Demo bleibt Demo</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Profi-Funktionen ohne Billing/Auth werden vorbereitet, aber nicht als freigeschaltet verkauft.
          </p>
        </article>
        <article className="rounded-[1.3rem] border border-stroke bg-panel p-4">
          <Lock className="h-5 w-5 text-muted" />
          <h2 className="mt-3 text-lg font-semibold text-mist">Backend-Gates fehlen noch</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Zahlung, Rollen, Limits und Entitlements müssen serverseitig bestätigt werden, bevor Upgrades aktiv sind.
          </p>
        </article>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-5">
        <h2 className="text-xl font-semibold text-mist">Welche Stufe passt zu welchem Nutzer?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Die Empfehlung ist bewusst konservativ. Sie beschreibt Nutzungsumfang, nicht Renditeerwartung.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {planRecommendations.map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-cyan">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-loss/25 bg-loss/10 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-1 h-5 w-5 shrink-0 text-loss" />
          <div>
            <h2 className="text-xl font-semibold text-mist">Kein echter Bezahlstatus ohne Backend-Prüfung</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Diese Seite zeigt Produktpläne und Feature-Gates. Aktiviert wird ein Plan erst, wenn Auth, Billing,
              Entitlements und serverseitige Limits erfolgreich geprüft wurden.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-5">
        <h2 className="text-xl font-semibold text-mist">Backend-Gate-Check vor Freischaltung</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {backendGateChecklist.map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-cyan">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {pricingTiers.map((tier) => {
          const Icon = tierIcons[tier.id];
          const stats = tierStats(tier);

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
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-profit/20 bg-profit/10 p-2 text-center">
                  <p className="font-mono text-lg font-semibold text-profit">{stats.included}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">aktiv</p>
                </div>
                <div className="rounded-xl border border-amber/20 bg-amber/10 p-2 text-center">
                  <p className="font-mono text-lg font-semibold text-amber">{stats.demo}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Demo</p>
                </div>
                <div className="rounded-xl border border-stroke bg-coal p-2 text-center">
                  <p className="font-mono text-lg font-semibold text-muted">{stats.locked}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">locked</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {featureDefinitions.map((feature) => {
                  const status = tier.featureStatus[feature.id];
                  const copy = featureStatusCopy(tier, status);
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

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-5">
        <h2 className="text-xl font-semibold text-mist">Nächste Backend-Schritte für echte Monetarisierung</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Auth", "Supabase-Session als Quelle für Userstatus und sichere user_id-Trennung."],
            ["Billing", "Stripe/Vercel Marketplace Entitlements serverseitig prüfen, nicht im Client vertrauen."],
            ["Limits", "Watchlist-, Alert-, Portfolio- und API-Limits pro Plan im Backend erzwingen."],
            ["Audit", "Planwechsel, Zahlstatus und Gate-Entscheidungen protokollieren."]
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-cyan">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
          Wichtig: Diese Preise und Gates sind Produktstruktur. Ohne serverseitig bestätigtes Billing wird kein Nutzer als Pro,
          Elite oder Business behandelt.
        </p>
      </section>
    </div>
  );
}
