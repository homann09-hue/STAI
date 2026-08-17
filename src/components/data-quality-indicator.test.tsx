// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  getQuoteVerificationDisplay,
  QuoteVerificationBadge,
} from "@/components/data-quality-indicator";
import type { NormalizedQuote } from "@/lib/types";

afterEach(cleanup);

function verification(
  overrides: Partial<
    Pick<
      NormalizedQuote,
      "provider" | "qualityIssues" | "qualityScore" | "qualityStatus"
    >
  > = {},
) {
  return {
    provider: "Primäranbieter",
    qualityIssues: ["single_provider_quote"],
    qualityScore: 74,
    qualityStatus: "PARTIAL" as const,
    ...overrides,
  };
}

describe("QuoteVerificationBadge", () => {
  it("kennzeichnet einen unabhängig bestätigten Primärkurs", () => {
    render(
      <QuoteVerificationBadge
        quote={verification({
          qualityIssues: ["cross_provider_confirmed"],
          qualityScore: 92,
          qualityStatus: "VALID",
        })}
      />,
    );

    expect(screen.getByText("Quellen bestätigt")).toBeTruthy();
    expect(screen.getByLabelText("Kursprüfung: Quellen bestätigt")).toBeTruthy();
  });

  it("warnt bei divergierenden Kursen vor gesperrten Analysen", () => {
    const display = getQuoteVerificationDisplay(
      verification({
        qualityIssues: ["cross_provider_divergent"],
        qualityScore: 25,
        qualityStatus: "DIVERGENT",
      }),
    );

    expect(display?.label).toBe("Quellen weichen ab");
    expect(display?.description).toContain("Analyse");
    expect(display?.description).toContain("gesperrt");
  });

  it("behauptet bei einer Einzelquelle keine unabhängige Bestätigung", () => {
    render(<QuoteVerificationBadge quote={verification()} />);

    expect(screen.getByText("Einzelquelle")).toBeTruthy();
    expect(screen.queryByText("Quellen bestätigt")).toBeNull();
  });

  it("bleibt ohne expliziten Prüfstatus unsichtbar", () => {
    const { container } = render(
      <QuoteVerificationBadge
        quote={verification({ qualityIssues: [], qualityStatus: "VALID" })}
      />,
    );

    expect(container.textContent).toBe("");
  });
});
