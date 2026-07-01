export type PlanId = "free" | "starter" | "pro" | "elite";
export type FeatureGateStatus = "included" | "demo" | "locked" | "not_available";

export type FeatureDefinition = {
  id:
    | "watchlist_basic"
    | "watchlist_extended"
    | "learning"
    | "asset_analysis"
    | "portfolio"
    | "alerts"
    | "ai_news"
    | "pro_terminal"
    | "exports"
    | "api"
    | "team";
  label: string;
  description: string;
};

export type PricingTier = {
  id: PlanId;
  name: string;
  price: string;
  audience: string;
  technicalStatus: string;
  featureStatus: Record<FeatureDefinition["id"], FeatureGateStatus>;
};

export const billingGateStatus = {
  active: false,
  label: "Demo / Billing nicht aktiv",
  explanation:
    "Feature-Gates sind produktseitig vorbereitet. Ohne geprüften Auth-/Billingstatus werden kostenpflichtige Funktionen nicht als freigeschaltet dargestellt."
} as const;

export const featureDefinitions: FeatureDefinition[] = [
  {
    id: "watchlist_basic",
    label: "Basis-Watchlist",
    description: "Kleine lokale oder synchronisierte Watchlist mit sichtbarer Datenqualität."
  },
  {
    id: "watchlist_extended",
    label: "Erweiterte Watchlist",
    description: "Mehr Symbole, Batching, Rate-Limit-Schutz und größere Listen."
  },
  {
    id: "learning",
    label: "Investieren lernen",
    description: "Einsteigerbereich, Glossar und Beispiel-Portfolios."
  },
  {
    id: "asset_analysis",
    label: "Asset-Analyse",
    description: "Kurs, Chart, Datenqualität, Risiko und modellbasierte Auswertung."
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Positionen, Risiko, Allokation, Szenarien und Supabase-Sync."
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "Regelmodell für Kurs, RSI, News, Volumen, Earnings und KI-Risiko."
  },
  {
    id: "ai_news",
    label: "News-KI",
    description: "Relevanz, Sentiment, Impact und Quellenstatus."
  },
  {
    id: "pro_terminal",
    label: "Profi-Terminal",
    description: "Tiefe Fundamentaldaten, ETF-Struktur, Risiko-Dashboard und Vergleiche."
  },
  {
    id: "exports",
    label: "Export",
    description: "PDF/CSV/API-Exports für professionelle Workflows."
  },
  {
    id: "api",
    label: "API-Zugriff",
    description: "Programmierbare Abfragen für Teams und Business-Nutzer."
  },
  {
    id: "team",
    label: "Teamfunktionen",
    description: "Mehrere Nutzer, Rollen, Governance und Audit-Trail."
  }
];

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    audience: "Basis-Watchlist und einfache Analysen",
    technicalStatus: "Aktiv als lokaler Demo-Modus",
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "locked",
      learning: "included",
      asset_analysis: "demo",
      portfolio: "demo",
      alerts: "demo",
      ai_news: "demo",
      pro_terminal: "locked",
      exports: "locked",
      api: "locked",
      team: "locked"
    }
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 €",
    audience: "kleine Anleger und Sparpläne",
    technicalStatus: "Vorbereitet, Billing-Gate nicht aktiv",
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "demo",
      learning: "included",
      asset_analysis: "demo",
      portfolio: "demo",
      alerts: "demo",
      ai_news: "demo",
      pro_terminal: "locked",
      exports: "locked",
      api: "locked",
      team: "locked"
    }
  },
  {
    id: "pro",
    name: "Pro",
    price: "29 €",
    audience: "aktive Investoren und Trader",
    technicalStatus: "Vorbereitet, nicht freigeschaltet",
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "demo",
      learning: "included",
      asset_analysis: "demo",
      portfolio: "demo",
      alerts: "demo",
      ai_news: "demo",
      pro_terminal: "demo",
      exports: "locked",
      api: "locked",
      team: "locked"
    }
  },
  {
    id: "elite",
    name: "Elite / Business",
    price: "auf Anfrage",
    audience: "Teams, Unternehmer und große Vermögen",
    technicalStatus: "Enterprise-Struktur vorbereitet, Vertrag/Billing nötig",
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "demo",
      learning: "included",
      asset_analysis: "demo",
      portfolio: "demo",
      alerts: "demo",
      ai_news: "demo",
      pro_terminal: "demo",
      exports: "demo",
      api: "demo",
      team: "demo"
    }
  }
];

export function getFeatureGateStatus(planId: PlanId, featureId: FeatureDefinition["id"]) {
  const tier = pricingTiers.find((item) => item.id === planId);
  return tier?.featureStatus[featureId] ?? "not_available";
}

export function isFeatureTechnicallyActive(planId: PlanId, featureId: FeatureDefinition["id"], billingActive = billingGateStatus.active) {
  const status = getFeatureGateStatus(planId, featureId);
  return status === "included" || (billingActive && status === "demo");
}
