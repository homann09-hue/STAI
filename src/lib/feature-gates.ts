export type PlanId = "free" | "pro" | "premium";
export type BillingInterval = "month" | "year";
export type FeatureGateStatus = "included" | "demo" | "locked" | "not_available";

/**
 * Tarife, Funktionen und Grenzen — die einzige Quelle.
 *
 * §3 verlangt: „Die Tarifstruktur muss zentral konfigurierbar sein. Keine
 * Tariflogik über hunderte Dateien verteilen." Deshalb steht hier alles, was
 * einen Tarif ausmacht, und nirgends sonst.
 *
 * **Die wichtigste Regel dieser Datei:** `included` bedeutet, dass die Funktion
 * heute existiert und benutzbar ist. Was der Tarifplan vorsieht, aber noch
 * nicht gebaut ist, steht als `demo` — angekündigt, nicht verkauft. Die
 * Paywall leitet den freischaltenden Tarif ausschließlich aus `included` ab
 * (`planThatUnlocks`). Damit ist ausgeschlossen, dass ein Upgrade für etwas
 * verkauft wird, das es nach dem Upgrade auch nicht gibt.
 */

export type FeatureId =
  // Grundlage, in jedem Tarif
  | "market_dashboard"
  | "asset_analysis"
  | "watchlist"
  | "alerts"
  | "portfolio"
  | "learning"
  | "ai_news"
  // Pro
  | "pro_terminal"
  | "screener"
  | "risk_analysis"
  | "scenario_analysis"
  | "peer_comparison"
  | "change_detection"
  // Premium
  | "advanced_screener"
  | "portfolio_risk"
  | "options_data"
  | "filings_monitoring"
  | "insider_monitoring"
  | "short_interest"
  | "advanced_alerts"
  | "exports"
  | "paper_trading"
  | "backtesting";

export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  description: string;
};

/**
 * Grenzen je Tarif. Die Namen folgen §4 der Zieldefinition.
 */
/**
 * Mengenbegrenzungen je Tarif.
 *
 * Hier standen zusätzlich `maxWatchlists` und `maxSavedScreeners`. Beide sind
 * entfernt, weil sie Funktionen begrenzten, **die es nicht gibt**: das
 * Datenmodell kennt genau eine Watchlist je Nutzer — `watchlists` ist eine
 * flache Tabelle aus `(user_id, symbol)`, ohne benannte Listen — und einen
 * gespeicherten Screener gibt es nirgends.
 *
 * Eine Durchsetzung dafür zu bauen wäre schlimmer gewesen als keine: sie hätte
 * ausgesehen, als gäbe es die Funktion. Nach §90 ist auch Konfiguration eine
 * Fassade, wenn sie Fähigkeiten verspricht, die nicht bestehen.
 *
 * Beide kommen zurück, sobald die Funktionen gebaut sind — dann mit einer Route,
 * die sie durchsetzt.
 */
export type PlanLimits = {
  maxWatchlistItems: number;
  maxAlerts: number;
  /** Wie viele Jahre Historie ein Tarif zeigen darf. */
  historicalDataYears: number;
  portfolios: number;
  aiAnalysesPerDay: number;
  apiRequestsPerDay: number;
};

export type PlanPricing = {
  /** Anzeigepreis pro Monat. */
  monthly: string;
  /** Anzeigepreis pro Jahr, oder null wenn es kein Jahresabo gibt. */
  yearly: string | null;
  /** Wie viel das Jahresabo gegenüber zwölf Monatszahlungen spart. */
  yearlySavingsNote: string | null;
};

export type PricingTier = {
  id: PlanId;
  name: string;
  price: string;
  pricing: PlanPricing;
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
    id: "market_dashboard",
    label: "Marktdashboard",
    description: "Indizes, Gewinner, Verlierer, Sektoren und Marktlage auf einen Blick."
  },
  {
    id: "asset_analysis",
    label: "Assetanalyse",
    description: "Kurs, Chart, Datenqualität, Kennzahlen und modellbasierte Auswertung je Instrument."
  },
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Eigene Listen mit Kurs, Tagesänderung und sichtbarer Datenqualität."
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "Regeln für Kurs, Volumen, Earnings und Risiko mit serverseitiger Auswertung."
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Positionen, Performance, Allokation und Entwicklung über die Zeit."
  },
  {
    id: "learning",
    label: "Investieren lernen",
    description: "Einsteigerbereich, Glossar und erklärte Kennzahlen."
  },
  {
    id: "ai_news",
    label: "News-Auswertung",
    description: "Relevanz, Stimmung und Einordnung von Nachrichten mit sichtbarer Quelle."
  },
  {
    id: "pro_terminal",
    label: "Profi-Terminal",
    description: "Tiefe Fundamentaldaten, ETF-Struktur, Risiko-Dashboard und Vergleiche."
  },
  {
    id: "screener",
    label: "Screener",
    description: "Instrumente nach Kennzahlen, Region und Assetklasse filtern."
  },
  {
    id: "risk_analysis",
    label: "Risikoanalyse",
    description: "Volatilität, Drawdown, Beta, Klumpenrisiko und Szenarien."
  },
  {
    id: "scenario_analysis",
    label: "Szenarien und Prognosen",
    description: "Bear, Base und Bull Case mit Bandbreiten, Annahmen und Konfidenz."
  },
  {
    id: "peer_comparison",
    label: "Peer-Vergleich",
    description: "Wettbewerber automatisch bestimmen und in Wachstum, Bewertung und Marge vergleichen."
  },
  {
    id: "change_detection",
    label: "Veränderungserkennung",
    description: "Erkennt, was sich seit dem letzten Blick verändert hat — Schätzungen, Margen, Analystenziele."
  },
  {
    id: "advanced_screener",
    label: "Erweiterter Screener",
    description: "Mehr Filter, speicherbare Suchen und Auswertung über das Gesamtuniversum."
  },
  {
    id: "portfolio_risk",
    label: "Portfolio-Risikoanalyse",
    description: "Korrelationen, Konzentration, Währungs- und Sektorrisiko des Gesamtbestands."
  },
  {
    id: "options_data",
    label: "Optionsdaten",
    description: "Optionsketten, Open Interest, implizite Volatilität und Put/Call-Verhältnis."
  },
  {
    id: "filings_monitoring",
    label: "SEC-Filings-Überwachung",
    description: "10-K, 10-Q, 8-K und Form 4 mit Verweis auf das Originaldokument."
  },
  {
    id: "insider_monitoring",
    label: "Insider-Überwachung",
    description: "Käufe und Verkäufe von Insidern, getrennt nach echten Käufen und Programmen."
  },
  {
    id: "short_interest",
    label: "Short Interest",
    description: "Leerverkaufsquote, Days to Cover und Veränderung über die Zeit."
  },
  {
    id: "advanced_alerts",
    label: "Erweiterte Alerts",
    description: "Mehr Regeltypen, höhere Frequenz und Benachrichtigung über mehrere Kanäle."
  },
  {
    id: "exports",
    label: "Export",
    description: "Watchlists, Portfolio, Screener und Analysen als CSV, PDF oder Excel."
  },
  {
    id: "paper_trading",
    label: "Paper Trading",
    description: "Virtuelles Kapital, echte Marktpreise, Orders mit Gebühren und Slippage."
  },
  {
    id: "backtesting",
    label: "Backtesting",
    description: "Regelbasierte Strategien auf Historie prüfen, mit Kosten und Bias-Kontrolle."
  }
];

/**
 * Wird im Tarif geführt, ist aber noch nicht gebaut.
 *
 * Diese Liste ist der Grund, warum die Preisseite ehrlich bleibt: alles hier
 * erscheint als „geplant", nicht als Leistung. Sobald eine Funktion existiert,
 * wandert sie in der jeweiligen Tarifzeile von `demo` auf `included` — und
 * damit wird sie auch von der Paywall verkaufbar.
 */
const plannedFeatures: FeatureId[] = [
  "peer_comparison",
  "change_detection",
  "advanced_screener",
  "options_data",
  "filings_monitoring",
  "insider_monitoring",
  "short_interest",
  "advanced_alerts",
  "exports",
  "paper_trading"
];

function statusMap(included: FeatureId[], locked: FeatureId[]): Record<FeatureId, FeatureGateStatus> {
  return Object.fromEntries(
    featureDefinitions.map((feature) => {
      if (plannedFeatures.includes(feature.id)) {
        // Geplante Funktionen sind im vorgesehenen Tarif sichtbar angekuendigt
        // und in den kleineren gesperrt -- aber nirgends `included`.
        return [feature.id, locked.includes(feature.id) ? "locked" : "demo"];
      }
      if (included.includes(feature.id)) return [feature.id, "included"];
      return [feature.id, "locked"];
    })
  ) as Record<FeatureId, FeatureGateStatus>;
}

const freeFeatures: FeatureId[] = [
  "market_dashboard",
  "asset_analysis",
  "watchlist",
  "alerts",
  "portfolio",
  "learning",
  "ai_news"
];

const proFeatures: FeatureId[] = [
  ...freeFeatures,
  "pro_terminal",
  "screener",
  "risk_analysis",
  "scenario_analysis",
  // Seit dem 2026-08-09 gebaut und serverseitig durchgesetzt: `runBacktest`
  // rechnet auf echten Tageskursen. Vorher stand es in `plannedFeatures`, weil
  // die Seite nur ein Zinseszinsrechner war -- und ein Tarifmerkmal fuer eine
  // Funktion, die es nicht gibt, waere nach §90 eine Fassade.
  "backtesting"
];

const premiumFeatures: FeatureId[] = [...proFeatures, "portfolio_risk"];

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    pricing: { monthly: "0 €", yearly: null, yearlySavingsNote: null },
    audience: "StockPilot ausprobieren",
    technicalStatus: "Ohne Zahlung aktiv, mit serverseitigen Free-Grenzen",
    billingRequired: false,
    featureStatus: statusMap(freeFeatures, plannedFeatures),
    limits: {
      maxWatchlistItems: 15,
      maxAlerts: 3,
      historicalDataYears: 1,
      portfolios: 1,
      aiAnalysesPerDay: 3,
      apiRequestsPerDay: 0
    }
  },
  {
    id: "pro",
    name: "Pro",
    price: "29,99 € / Monat",
    pricing: {
      monthly: "29,99 € / Monat",
      yearly: "299,90 € / Jahr",
      yearlySavingsNote: "Zwei Monate günstiger als die monatliche Zahlung"
    },
    audience: "Aktive Anleger, die vollständig analysieren wollen",
    technicalStatus: "Freigabe ausschließlich über Checkout und signierten Webhook",
    billingRequired: true,
    featureStatus: statusMap(proFeatures, [
      "advanced_screener",
      "options_data",
      "filings_monitoring",
      "insider_monitoring",
      "short_interest",
      "advanced_alerts",
      "exports",
      "paper_trading"
    ]),
    limits: {
      maxWatchlistItems: 250,
      maxAlerts: 100,
      historicalDataYears: 10,
      portfolios: 10,
      aiAnalysesPerDay: 100,
      apiRequestsPerDay: 1_000
    }
  },
  {
    id: "premium",
    name: "Premium",
    price: "69,99 € / Monat",
    pricing: {
      monthly: "69,99 € / Monat",
      yearly: "699,90 € / Jahr",
      yearlySavingsNote: "Zwei Monate günstiger als die monatliche Zahlung"
    },
    audience: "Intensivnutzer mit höheren Grenzen und Zusatzdaten",
    technicalStatus: "Freigabe ausschließlich über Checkout und signierten Webhook",
    billingRequired: true,
    featureStatus: statusMap(premiumFeatures, []),
    limits: {
      maxWatchlistItems: 1_000,
      maxAlerts: 500,
      historicalDataYears: 20,
      portfolios: 25,
      aiAnalysesPerDay: 500,
      apiRequestsPerDay: 10_000
    }
  }
];

/** Tarife, die über Stripe gebucht werden. */
export type PaidPlanId = Exclude<PlanId, "free">;

export const paidPlanIds: PaidPlanId[] = ["pro", "premium"];

export function getPricingTier(planId: PlanId) {
  return pricingTiers.find((item) => item.id === planId) ?? pricingTiers[0];
}

export function getFeatureGateStatus(planId: PlanId, featureId: FeatureId) {
  return getPricingTier(planId).featureStatus[featureId] ?? "not_available";
}

export function getPlanLimits(planId: PlanId) {
  return getPricingTier(planId).limits;
}

export function getPlanPrice(planId: PlanId, interval: BillingInterval) {
  const pricing = getPricingTier(planId).pricing;
  return interval === "year" ? pricing.yearly : pricing.monthly;
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
