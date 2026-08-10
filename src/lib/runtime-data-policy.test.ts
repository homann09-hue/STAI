import { describe, expect, it } from "vitest";
import { developmentFixturesAllowed } from "@/lib/runtime-data-policy";

describe("Produktionsrichtlinie fuer Fixtures", () => {
  it("verbietet Fixtures in Vercel Production auch bei versehentlichem Testschalter", () => {
    expect(
      developmentFixturesAllowed({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        STOCKPILOT_ALLOW_TEST_FIXTURES: "true"
      })
    ).toBe(false);
  });

  it("erlaubt Fixtures in Test und Entwicklung", () => {
    expect(developmentFixturesAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(developmentFixturesAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("verlangt bei lokalem Production-E2E einen expliziten Schalter", () => {
    expect(developmentFixturesAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(
      developmentFixturesAllowed({
        NODE_ENV: "production",
        STOCKPILOT_ALLOW_TEST_FIXTURES: "true"
      })
    ).toBe(true);
  });
});
