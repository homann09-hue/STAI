import { getPricingTier, type PlanId } from "@/lib/feature-gates";

/**
 * Kostenmodell für externe Datenabrufe.
 *
 * §7 stellt eine Frage, die bisher niemand beantworten konnte: „Ein Nutzer darf
 * nicht durch ineffiziente API-Aufrufe mehr Kosten verursachen als sein Abo
 * einbringt." Um das zu prüfen, braucht es drei Dinge — was ein Abruf kostet,
 * wie viele Abrufe ein Konto auslöst und was der Tarif einbringt.
 *
 * Diese Datei liefert das erste und das dritte und rechnet daraus die Marge.
 * Das zweite kommt aus der Zählung der Abrufe.
 *
 * **Geld wird in ganzen Cent gerechnet, nie in Fließkomma.** 0,1 + 0,2 ist in
 * IEEE-754 nicht 0,3, und ein Rundungsfehler in einer Kostenrechnung fällt erst
 * auf, wenn er groß genug ist, um wehzutun.
 */

export type ProviderId =
  | "fmp"
  | "finnhub"
  | "alpha_vantage"
  | "twelve_data"
  | "marketaux"
  | "ecb"
  | "fred"
  | "ai_model";

export type ProviderCostModel = {
  id: ProviderId;
  label: string;
  /**
   * Kosten je Abruf in Zehntel-Cent. Ganzzahlig, damit sich Beträge ohne
   * Rundungsfehler summieren lassen.
   */
  costPerCallTenthCents: number;
  /** Woher der Wert stammt. Ohne Beleg ist eine Kostenzahl eine Behauptung. */
  basis: string;
};

/**
 * Kosten je Abruf.
 *
 * Die Werte stammen aus den veröffentlichten Tarifen der Anbieter, geteilt
 * durch das im Tarif enthaltene Abrufkontingent. Sie sind Schätzungen mit
 * offengelegter Herleitung — nicht abgerechnete Beträge. Wer sie ändert, muss
 * die Herleitung mitändern.
 */
export const providerCostModels: Record<ProviderId, ProviderCostModel> = {
  fmp: {
    id: "fmp",
    label: "Financial Modeling Prep",
    costPerCallTenthCents: 1,
    basis: "Starter 19 USD/Monat bei 300 Abrufen pro Minute — praktisch limitierend ist der Tarif, nicht der Einzelabruf."
  },
  finnhub: {
    id: "finnhub",
    label: "Finnhub",
    costPerCallTenthCents: 1,
    basis: "Vergleichbare Tarifstruktur zu FMP; ohne gebuchten Tarif eine Obergrenze."
  },
  alpha_vantage: {
    id: "alpha_vantage",
    label: "Alpha Vantage",
    costPerCallTenthCents: 2,
    basis: "Premium-Tarife mit engen Minutenkontingenten, daher höher angesetzt."
  },
  twelve_data: {
    id: "twelve_data",
    label: "Twelve Data",
    costPerCallTenthCents: 1,
    basis: "Kreditbasierte Abrechnung; ein Standardabruf entspricht einem Kredit."
  },
  marketaux: {
    id: "marketaux",
    label: "Marketaux",
    costPerCallTenthCents: 3,
    basis: "Nachrichtenabrufe sind je Anfrage teurer als Kursabrufe."
  },
  ecb: {
    id: "ecb",
    label: "ECB Data Portal",
    costPerCallTenthCents: 0,
    basis: "Kostenlos und ohne Schlüssel. Verursacht keine Datenkosten."
  },
  fred: {
    id: "fred",
    label: "FRED (Federal Reserve Bank of St. Louis)",
    costPerCallTenthCents: 0,
    basis:
      "Der CSV-Export ist kostenlos und ohne Schlüssel erreichbar. Verursacht keine Datenkosten — die Zwischenspeicherung ist hier Rücksicht auf eine öffentliche Quelle, nicht Kostensenkung."
  },
  ai_model: {
    id: "ai_model",
    label: "Sprachmodell",
    costPerCallTenthCents: 20,
    basis: "Eine Analyse mit rund 2.000 Ein- und 1.400 Ausgabetoken zu üblichen Modellpreisen."
  }
};

export type ProviderUsageRecord = {
  provider: ProviderId;
  /** Abrufe, die tatsächlich beim Anbieter gelandet sind. */
  fetches: number;
  /** Anfragen, die aus dem Cache bedient wurden und nichts gekostet haben. */
  cacheHits: number;
};

export type CostSummary = {
  /** Gesamtkosten in Zehntel-Cent. */
  totalTenthCents: number;
  fetches: number;
  cacheHits: number;
  requests: number;
  /** Anteil der Anfragen, die den Anbieter nicht erreicht haben. Null ohne Anfragen. */
  cacheHitRate: number | null;
  /** Was ohne Cache zusätzlich angefallen wäre, in Zehntel-Cent. */
  savedByCacheTenthCents: number;
  byProvider: Array<ProviderUsageRecord & { costTenthCents: number }>;
};

export function summarizeCost(records: readonly ProviderUsageRecord[]): CostSummary {
  const byProvider = records.map((record) => {
    const model = providerCostModels[record.provider];
    const unit = model?.costPerCallTenthCents ?? 0;
    return { ...record, costTenthCents: Math.max(0, Math.round(record.fetches)) * unit };
  });

  const fetches = byProvider.reduce((sum, row) => sum + Math.max(0, Math.round(row.fetches)), 0);
  const cacheHits = byProvider.reduce((sum, row) => sum + Math.max(0, Math.round(row.cacheHits)), 0);
  const requests = fetches + cacheHits;

  const savedByCacheTenthCents = byProvider.reduce((sum, row) => {
    const unit = providerCostModels[row.provider]?.costPerCallTenthCents ?? 0;
    return sum + Math.max(0, Math.round(row.cacheHits)) * unit;
  }, 0);

  return {
    totalTenthCents: byProvider.reduce((sum, row) => sum + row.costTenthCents, 0),
    fetches,
    cacheHits,
    requests,
    // Ohne eine einzige Anfrage gibt es keine Quote. 100 % waere hier eine
    // Schoenfaerberei -- gemessen wurde nichts.
    cacheHitRate: requests === 0 ? null : cacheHits / requests,
    savedByCacheTenthCents,
    byProvider
  };
}

/** Monatlicher Ertrag eines Tarifs in Zehntel-Cent, aus der Preisangabe gelesen. */
export function monthlyRevenueTenthCents(plan: PlanId): number {
  const price = getPricingTier(plan).pricing.monthly;
  const match = price.match(/(\d+)(?:[.,](\d{1,2}))?/);
  if (!match) return 0;
  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "0").padEnd(2, "0"));
  return (euros * 100 + cents) * 10;
}

export type MarginAssessment = {
  plan: PlanId;
  revenueTenthCents: number;
  costTenthCents: number;
  marginTenthCents: number;
  /** Anteil der Einnahmen, der für Datenkosten draufgeht. Null bei Free. */
  costRatio: number | null;
  verdict: "healthy" | "watch" | "loss_making" | "no_revenue";
  message: string;
};

/** Ab welchem Kostenanteil ein Tarif beobachtet werden sollte. */
const WATCH_THRESHOLD = 0.3;

/**
 * Stellt Kosten und Ertrag eines Kontos gegenüber.
 *
 * Der Free-Tarif ist naturgemäß defizitär — das ist kein Alarm, sondern der
 * Zweck eines kostenlosen Zugangs. Deshalb bekommt er ein eigenes Urteil und
 * wird nicht als „verlustbringend" gemeldet, was die Liste unbrauchbar machen
 * würde.
 */
export function assessMargin(plan: PlanId, costTenthCents: number): MarginAssessment {
  const revenueTenthCents = monthlyRevenueTenthCents(plan);
  const cost = Math.max(0, Math.round(costTenthCents));
  const marginTenthCents = revenueTenthCents - cost;

  if (revenueTenthCents === 0) {
    return {
      plan,
      revenueTenthCents,
      costTenthCents: cost,
      marginTenthCents,
      costRatio: null,
      verdict: "no_revenue",
      message:
        cost === 0
          ? "Kostenloser Zugang ohne messbare Datenkosten."
          : `Kostenloser Zugang mit ${formatTenthCents(cost)} Datenkosten. Free ist bewusst defizitär — entscheidend ist, dass die Grenzen greifen.`
    };
  }

  const costRatio = cost / revenueTenthCents;

  if (marginTenthCents < 0) {
    return {
      plan,
      revenueTenthCents,
      costTenthCents: cost,
      marginTenthCents,
      costRatio,
      verdict: "loss_making",
      message: `Die Datenkosten von ${formatTenthCents(cost)} übersteigen den Ertrag von ${formatTenthCents(revenueTenthCents)}. Dieses Konto kostet mehr, als es einbringt.`
    };
  }

  return {
    plan,
    revenueTenthCents,
    costTenthCents: cost,
    marginTenthCents,
    costRatio,
    verdict: costRatio >= WATCH_THRESHOLD ? "watch" : "healthy",
    message:
      costRatio >= WATCH_THRESHOLD
        ? `${Math.round(costRatio * 100)} % des Ertrags gehen für Daten drauf. Das ist tragfähig, aber beobachtenswert.`
        : `${Math.round(costRatio * 100)} % des Ertrags gehen für Daten drauf.`
  };
}

/** Zehntel-Cent als lesbarer Betrag. */
export function formatTenthCents(value: number) {
  return (value / 1_000).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  });
}
