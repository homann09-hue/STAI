import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const centralizedModules = [
  "src/lib/providers/corporate-actions-provider.ts",
  "src/lib/providers/price-history.ts",
  "src/lib/providers/fundamentals-provider.ts",
  "src/lib/providers/instrument-directory-provider.ts",
  "src/lib/providers/exchange-calendar-provider.ts",
  "src/lib/providers/valuation-data.ts",
];

function source(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}

describe("FMP migration contract", () => {
  it.each(centralizedModules)("keeps %s behind the central client", (path) => {
    const content = source(path);
    expect(content).toContain("@/lib/providers/fmp-client");

    const fmpSection = content.match(/class Fmp[^]*?(?=\nclass |\nexport |$)/)?.[0] ?? content;
    expect(fmpSection).not.toContain("fetchBoundedProviderJson");
    expect(fmpSection).not.toContain('searchParams.set("apikey"');
    expect(fmpSection).not.toContain("FMP_API_BASE_URL");
  });

  it("keeps the FMP quote adapter free of direct URL and key handling", () => {
    const content = source("src/lib/providers/market-provider.ts");
    const fmpClass = content.slice(
      content.indexOf("class FmpQuoteProvider"),
      content.indexOf("class BinanceQuoteProvider"),
    );
    expect(fmpClass).toContain("getFmpClient().request");
    expect(fmpClass).not.toContain("new URL");
    expect(fmpClass).not.toContain("FMP_API_KEY");
    expect(fmpClass).not.toContain("fetchJson");
  });

  it("fails closed before loading FMP valuation data without provider rights", () => {
    const valuation = source("src/lib/providers/valuation-data.ts");
    expect(valuation).toContain('capability: "fundamentals"');
    expect(valuation).toContain('preferredProvider: "fmp"');
    expect(valuation).toContain('if (!route.providers.includes("fmp")) return null');
  });

  it("keeps FMP news and health checks behind the central client", () => {
    const adapters = source("src/lib/intelligence/adapters.ts");
    const fmpNews = adapters.slice(
      adapters.indexOf("export class FmpNewsAdapter"),
      adapters.indexOf("const secSubmissionSchema"),
    );
    expect(fmpNews).toContain("getFmpClient");
    expect(fmpNews).not.toContain("fetchJsonWithRetry");
    expect(fmpNews).not.toContain('searchParams.set("apikey"');

    const ping = source("src/lib/provider-ping.ts");
    expect(ping).toContain("timedFmpCheck");
    expect(ping).not.toContain('timedCheck("fmp"');
    expect(ping).not.toContain("quote-short/AAPL");
  });
});
