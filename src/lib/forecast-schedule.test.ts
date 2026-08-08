import { describe, expect, it } from "vitest";
import { shouldGenerateForecasts } from "./forecast-schedule";

describe("shouldGenerateForecasts", () => {
  it("laeuft an Handelstagen", () => {
    // 2026-08-03 ist ein Montag, 2026-08-07 ein Freitag.
    expect(shouldGenerateForecasts(new Date("2026-08-03T08:00:00.000Z")).shouldRun).toBe(true);
    expect(shouldGenerateForecasts(new Date("2026-08-07T08:00:00.000Z")).shouldRun).toBe(true);
  });

  it("laeuft am Wochenende nicht", () => {
    // 2026-08-08 Samstag, 2026-08-09 Sonntag.
    const samstag = shouldGenerateForecasts(new Date("2026-08-08T08:00:00.000Z"));
    const sonntag = shouldGenerateForecasts(new Date("2026-08-09T08:00:00.000Z"));

    expect(samstag.shouldRun).toBe(false);
    expect(sonntag.shouldRun).toBe(false);
    expect(samstag.reason).toMatch(/Wochenende/i);
  });

  it("laesst sich das Wochenende bewusst freischalten", () => {
    expect(
      shouldGenerateForecasts(new Date("2026-08-08T08:00:00.000Z"), { allowWeekend: true }).shouldRun
    ).toBe(true);
  });

  it("bewertet nach UTC, nicht nach lokaler Zeit des Servers", () => {
    // Sonntag 23:30 UTC ist in Europa bereits Montag. Massgeblich ist UTC,
    // damit das Verhalten unabhaengig von der Region der Function ist.
    const decision = shouldGenerateForecasts(new Date("2026-08-09T23:30:00.000Z"));
    expect(decision.shouldRun).toBe(false);
  });

  it("nennt immer einen Grund", () => {
    expect(shouldGenerateForecasts(new Date("2026-08-03T08:00:00.000Z")).reason).toBeTruthy();
    expect(shouldGenerateForecasts(new Date("2026-08-08T08:00:00.000Z")).reason).toBeTruthy();
  });
});
