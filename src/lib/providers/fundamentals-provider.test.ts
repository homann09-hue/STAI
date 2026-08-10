import { describe, expect, it } from "vitest";
import { normalizeProviderPercentage } from "@/lib/providers/fundamentals-provider";

describe("normalizeProviderPercentage", () => {
  it("wandelt Dezimalquoten in Prozentwerte um", () => {
    expect(normalizeProviderPercentage(0.00344581)).toBe(0.344581);
    expect(normalizeProviderPercentage("0.082")).toBe(8.2);
    expect(normalizeProviderPercentage(-0.12)).toBe(-12);
  });

  it("lässt bereits normalisierte Prozentwerte unverändert", () => {
    expect(normalizeProviderPercentage(8.2)).toBe(8.2);
    expect(normalizeProviderPercentage("12.5")).toBe(12.5);
  });

  it("erfindet für fehlende oder ungültige Werte keine Zahl", () => {
    expect(normalizeProviderPercentage(null)).toBeUndefined();
    expect(normalizeProviderPercentage("nicht-verfügbar")).toBeUndefined();
  });
});
