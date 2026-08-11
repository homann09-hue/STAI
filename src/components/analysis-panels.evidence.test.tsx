// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceScoreMeter, ProbabilityPanel } from "@/components/analysis-panels";
import type { ProfessionalScores } from "@/lib/types";

afterEach(cleanup);

const emptyScores: ProfessionalScores = {
  technical: 0,
  fundamental: 0,
  news: 0,
  sentiment: 0,
  momentum: 0,
  volatilityRisk: 0,
  liquidityRisk: 0,
  eventRisk: 0,
  opportunityTotal: 0,
  riskTotal: 0,
  probabilityUp: 0,
  probabilityDown: 0,
  probabilitySideways: 0,
  explanation: []
};

describe("evidence-bound analysis panels", () => {
  it("shows unavailable scores as n/a instead of a synthetic number", () => {
    render(<EvidenceScoreMeter label="Fundamental" value={null} />);

    expect(screen.getByText("n/a")).toBeTruthy();
    expect(screen.getByText("Nicht belegt")).toBeTruthy();
  });

  it("withholds zeroed scenario probabilities", () => {
    render(<ProbabilityPanel scores={emptyScores} />);

    expect(screen.getByText(/Wahrscheinlichkeiten zurückgehalten/)).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });
});
