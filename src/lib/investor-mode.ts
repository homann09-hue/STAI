export type InvestorMode = "beginner" | "advanced" | "pro";

export const INVESTOR_MODE_STORAGE_KEY = "stockpilot:investor-mode";
export const INVESTOR_MODE_EVENT = "stockpilot:investor-mode";

export const investorModeProfiles: Record<
  InvestorMode,
  { label: string; hint: string; description: string }
> = {
  beginner: {
    label: "Anfänger",
    hint: "Einfache Sprache, Ampel, Risiko zuerst.",
    description:
      "Entscheidungsrelevante Übersicht mit verständlicher Einordnung, Risiken und Datenqualität."
  },
  advanced: {
    label: "Fortgeschritten",
    hint: "Kennzahlen, News, Vergleiche.",
    description:
      "Zusätzliche Bewertungsmodelle, Kennzahlenverläufe, Vergleichsgruppen und Analysefaktoren."
  },
  pro: {
    label: "Profi",
    hint: "Szenarien, Drawdown, Governance.",
    description:
      "Vollständige Research-Tiefe einschließlich regulatorischer Quellen, Modellpass und Provenienz."
  }
};

export type InvestorModePolicy = {
  showValuation: boolean;
  showProfessionalScores: boolean;
  showAnalysisLayers: boolean;
  showRegulatoryResearch: boolean;
  showModelGovernance: boolean;
};

const policies: Record<InvestorMode, InvestorModePolicy> = {
  beginner: {
    showValuation: false,
    showProfessionalScores: false,
    showAnalysisLayers: false,
    showRegulatoryResearch: false,
    showModelGovernance: false
  },
  advanced: {
    showValuation: true,
    showProfessionalScores: true,
    showAnalysisLayers: true,
    showRegulatoryResearch: false,
    showModelGovernance: false
  },
  pro: {
    showValuation: true,
    showProfessionalScores: true,
    showAnalysisLayers: true,
    showRegulatoryResearch: true,
    showModelGovernance: true
  }
};

export function normalizeInvestorMode(value: unknown): InvestorMode {
  return value === "advanced" || value === "pro" || value === "beginner" ? value : "beginner";
}

export function investorModeFromExperienceLevel(
  level: "anfänger" | "fortgeschritten" | "profi"
): InvestorMode {
  if (level === "profi") return "pro";
  if (level === "fortgeschritten") return "advanced";
  return "beginner";
}

export function getInvestorModePolicy(mode: InvestorMode): InvestorModePolicy {
  return policies[mode];
}

