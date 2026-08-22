import { describe, expect, it } from "vitest";
import {
  instrumentDetailHref,
  isCanonicalInstrumentId,
  resolveInstrumentCandidates,
  type KnownInstrumentIdentity,
} from "./instrument-resolution";

function identity(overrides: Partial<KnownInstrumentIdentity> = {}): KnownInstrumentIdentity {
  return {
    internalInstrumentId: "11111111-1111-4111-8111-111111111111",
    canonicalId: "stock:xnas:abc:usd",
    symbol: "ABC",
    name: "ABC Corporation",
    assetClass: "stock",
    exchange: "NASDAQ",
    exchangeCode: "NASDAQ",
    mic: "XNAS",
    currency: "USD",
    provider: "FMP",
    quoteStatus: "available",
    ...overrides,
  };
}

describe("canonical instrument resolution", () => {
  it("never chooses between two listings that share a symbol", () => {
    const result = resolveInstrumentCandidates("ABC", [
      identity(),
      identity({
        internalInstrumentId: "22222222-2222-4222-8222-222222222222",
        canonicalId: "stock:xetr:abc:eur",
        exchange: "XETRA",
        exchangeCode: "XETRA",
        mic: "XETR",
        currency: "EUR",
      }),
    ]);

    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") throw new Error("expected ambiguity");
    expect(result.candidates.map((candidate) => candidate.currency).sort()).toEqual(["EUR", "USD"]);
  });

  it("resolves only the explicitly selected canonical listing", () => {
    const xetra = identity({
      canonicalId: "stock:xetr:abc:eur",
      exchange: "XETRA",
      currency: "EUR",
    });
    const result = resolveInstrumentCandidates("ABC", [identity(), xetra], {
      requestedCanonicalId: xetra.canonicalId,
    });

    expect(result).toEqual({ status: "resolved", identity: xetra });
  });

  it("does not accept a canonical ID belonging to another symbol", () => {
    const result = resolveInstrumentCandidates("ABC", [identity({ symbol: "XYZ" })], {
      requestedCanonicalId: "stock:xnas:xyz:usd",
    });
    expect(result).toEqual({ status: "not_found", symbol: "ABC" });
  });

  it("builds listing-specific detail links and validates bounded IDs", () => {
    expect(instrumentDetailHref(identity())).toBe(
      "/assets/ABC?canonicalId=stock%3Axnas%3Aabc%3Ausd",
    );
    expect(isCanonicalInstrumentId("stock:xnas:abc:usd")).toBe(true);
    expect(isCanonicalInstrumentId("<script>")).toBe(false);
    expect(isCanonicalInstrumentId(`stock:${"a".repeat(200)}`)).toBe(false);
  });
});
