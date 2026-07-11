export type PlanId = "free" | "starter" | "pro" | "elite";
export type FeatureGateStatus = "included" | "demo" | "locked" | "not_available";

export type FeatureId =
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

export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  description: string;
};

export type PlanLimits = {
  watchlistItems: number;
  alerts: number;
  portfolios: number;
  aiAnalysesPerDay: number;
  apiRequestsPerDay: number;
};

export type PricingTier = {
  id: PlanId;
  name: string;
  price: string;
  audience: string;
  technicalStatus: string;
  billingRequired: boolean;
  featureStatus: Record<FeatureId, FeatureGateStatus>;
  limits: PlanLimits;
};

export const billingGateStatus = {
  active: false,
  label: "Serverseitige Prüfung erforderlich",
  explanation:
    "Kostenpflichtige Funktionen werden nur nach gültiger Supabase-Session, bestätigtem Providerstatus und serverseitiger Entitlement-Prüfung freigeschaltet."
} as const;

export const featureDefinitions: FeatureDefinition[] = [
  {
    id: "watchlist_basic",
    label: "Basis-Watchlist",
    description: "Private Watchlist mit sichtbarer Datenqualität und Cloud-Sync nach Anmeldung."
  },
  {
    id: "watchlist_extended",
    label: "Erweiterte Watchlist",
    description: "Größere Listen, Batching und höhere serverseitige Nutzungslimits."
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
    description: "Regeln für Kurs, RSI, News, Volumen, Earnings und KI-Risiko."
  },
  {
    id: "ai_news",
    label: "News-KI",
    description: "Relevanz, Sentiment, Impact und transparenter Quellenstatus."
  },
  {
    id: "pro_terminal",
    label: "Profi-Terminal",
    description: "Tiefe Fundamentaldaten, ETF-Struktur, Risiko-Dashboard und Vergleiche."
  },
  {
    id: "exports",
    label: "Analyse-Export",
    description: "Geplante PDF-/CSV-Exporte für professionelle Analyse-Workflows."
  },
  {
    id: "api",
    label: "API-Zugriff",
    description: "Geplanter programmierbarer Zugriff mit eigenen Quoten und Auditierung."
  },
  {
    id: "team",
    label: "Teamfunktionen",
    description: "Geplante Rollen, Governance, mehrere Nutzer und Audit-Trail."
  }
];

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    audience: "Beobachten, lernen und erste Analysen",
    technicalStatus: "Ohne Zahlung aktiv, mit serverseitigen Free-Limits",
    billingRequired: false,
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "locked",
      learning: "included",
      asset_analysis: "included",
      portfolio: "included",
      alerts: "included",
      ai_news: "included",
      pro_terminal: "locked",
      exports: "locked",
      api: "locked",
      team: "locked"
    },
    limits: {
      watchlistItems: 10,
      alerts: 3,
      portfolios: 1,
      aiAnalysesPerDay: 3,
      apiRequestsPerDay: 0
    }
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 € / Monat",
    audience: "Kleine Anleger und strukturierte Sparpläne",
    technicalStatus: "Freigabe ausschließlich über Checkout und signierten Webhook",
    billingRequired: true,
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "included",
      learning: "included",
      asset_analysis: "included",
      portfolio: "included",
      alerts: "included",
      ai_news: "included",
      pro_terminal: "locked",
      exports: "locked",
      api: "locked",
      team: "locked"
    },
    limits: {
      watchlistItems: 50,
      alerts: 25,
      portfolios: 2,
      aiAnalysesPerDay: 20,
      apiRequestsPerDay: 0
    }
  },
  {
    id: "pro",
    name: "Pro",
    price: "29 € / Monat",
    audience: "Aktive Investoren und professionelle Einzelanwender",
    technicalStatus: "Freigabe ausschließlich über Checkout und signierten Webhook",
    billingRequired: true,
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "included",
      learning: "included",
      asset_analysis: "included",
      portfolio: "included",
      alerts: "included",
      ai_news: "included",
      pro_terminal: "included",
      exports: "demo",
      api: "locked",
      team: "locked"
    },
    limits: {
      watchlistItems: 250,
      alerts: 100,
      portfolios: 10,
      aiAnalysesPerDay: 100,
      apiRequestsPerDay: 1_000
    }
  },
  {
    id: "elite",
    name: "Elite / Business",
    price: "auf Anfrage",
    audience: "Teams, Unternehmer und große Vermögen",
    technicalStatus: "Manuelle Vertrags- und Rollenfreigabe erforderlich",
    billingRequired: true,
    featureStatus: {
      watchlist_basic: "included",
      watchlist_extended: "included",
      learning: "included",
      asset_analysis: "included",
      portfolio: "included",
      alerts: "included",
      ai_news: "included",
      pro_terminal: "included",
      exports: "demo",
      api: "demo",
      team: "demo"
    },
    limits: {
      watchlistItems: 1_000,
      alerts: 500,
      portfolios: 25,
      aiAnalysesPerDay: 1_000,
      apiRequestsPerDay: 10_000
    }
  }
];

export function getPricingTier(planId: PlanId) {
  return pricingTiers.find((item) => item.id === planId) ?? pricingTiers[0];
}

export function getFeatureGateStatus(planId: PlanId, featureId: FeatureId) {
  return getPricingTier(planId).featureStatus[featureId] ?? "not_available";
}

export function getPlanLimits(planId: PlanId) {
  return getPricingTier(planId).limits;
}

export function isFeatureTechnicallyActive(
  planId: PlanId,
  featureId: FeatureId,
  billingActive = planId === "free"
) {
  const tier = getPricingTier(planId);
  if (tier.billingRequired && !billingActive) return false;
  return getFeatureGateStatus(planId, featureId) === "included";
}
