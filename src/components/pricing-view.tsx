"use client";

import { BriefcaseBusiness, Check, Crown, Rocket, Shield } from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: "0 €",
    icon: Shield,
    audience: "Basis-Watchlist und einfache Analysen",
    features: ["5 Watchlist-Werte", "einfache Score-Erklärung", "Mock-/Delay-Kennzeichnung", "Lernbereich"]
  },
  {
    name: "Starter",
    price: "9 €",
    icon: Rocket,
    audience: "kleine Anleger und Sparpläne",
    features: ["mehr Watchlist", "Beispiel-Portfolios", "Risiko-Ampel", "Basis-Alerts"]
  },
  {
    name: "Pro",
    price: "29 €",
    icon: BriefcaseBusiness,
    audience: "aktive Investoren und Trader",
    features: ["tiefe Asset-Analyse", "Portfolio-Risiko", "News-KI", "Szenario-Rechner", "Earnings-Kalender"]
  },
  {
    name: "Elite / Business",
    price: "auf Anfrage",
    icon: Crown,
    audience: "Teams, Unternehmer und große Vermögen",
    features: ["mehrere Portfolios", "Export", "API-Zugriff", "Teamfunktionen", "Governance-Dashboard"]
  }
];

export function PricingView() {
  return (
    <div className="space-y-7">
      <section className="rounded-[1.6rem] border border-amber/20 bg-[radial-gradient(circle_at_top_right,rgba(245,201,107,0.14),transparent_34%),linear-gradient(145deg,#101712,#050706_72%)] p-5 shadow-panel sm:p-7">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Feature-Gates vorbereitet</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Preise ohne harte Backend-Sperre.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          Die Stufen sind produktseitig vorbereitet, aber aktuell nicht erzwungen. Sobald Auth,
          Billing und Supabase-Persistenz aktiv sind, können Features sauber freigeschaltet werden.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {tiers.map((tier) => {
          const Icon = tier.icon;

          return (
            <article key={tier.name} className="rounded-[1.3rem] border border-stroke bg-panel p-5 shadow-panel">
              <Icon className="h-6 w-6 text-cyan" />
              <h2 className="mt-4 text-xl font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-muted">{tier.audience}</p>
              <p className="mt-4 font-mono text-3xl font-semibold text-mist">{tier.price}</p>
              <div className="mt-5 space-y-3">
                {tier.features.map((feature) => (
                  <p key={feature} className="flex gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                    {feature}
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
