import { describe, expect, it } from "vitest";
import {
  getInvestorModePolicy,
  investorModeFromExperienceLevel,
  normalizeInvestorMode
} from "@/lib/investor-mode";

describe("investor mode", () => {
  it("fällt bei manipulierten oder alten Speicherwerten sicher auf Anfänger zurück", () => {
    expect(normalizeInvestorMode("unknown")).toBe("beginner");
    expect(normalizeInvestorMode(null)).toBe("beginner");
    expect(normalizeInvestorMode("pro")).toBe("pro");
  });

  it("übersetzt das Onboarding in dieselbe zentrale Modus-Sprache", () => {
    expect(investorModeFromExperienceLevel("anfänger")).toBe("beginner");
    expect(investorModeFromExperienceLevel("fortgeschritten")).toBe("advanced");
    expect(investorModeFromExperienceLevel("profi")).toBe("pro");
  });

  it("staffelt zusätzliche Komplexität, ohne die Basisebene zu verändern", () => {
    expect(getInvestorModePolicy("beginner")).toEqual({
      showValuation: false,
      showProfessionalScores: false,
      showAnalysisLayers: false,
      showRegulatoryResearch: false,
      showModelGovernance: false
    });
    expect(getInvestorModePolicy("advanced").showValuation).toBe(true);
    expect(getInvestorModePolicy("advanced").showModelGovernance).toBe(false);
    expect(getInvestorModePolicy("pro").showModelGovernance).toBe(true);
  });
});

