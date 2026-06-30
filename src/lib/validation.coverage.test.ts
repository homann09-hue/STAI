import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  alertInputSchema,
  alertUpdateInputSchema,
  portfolioDeleteInputSchema,
  portfolioTradeInputSchema,
  sanitizeError,
  validateSymbol,
  watchlistInputSchema
} from "./validation";

describe("validation schemas coverage", () => {
  it("normalizes symbols and rejects unsafe input", () => {
    expect(validateSymbol(" aapl ").data).toBe("AAPL");
    expect(validateSymbol("btc-usd").data).toBe("BTC-USD");
    expect(validateSymbol("BRK.B").data).toBe("BRK.B");
    expect(validateSymbol("bad symbol!").success).toBe(false);
    expect(validateSymbol("").success).toBe(false);
    expect(() => validateSymbol("%%%")).not.toThrow();
    expect(validateSymbol("%%%").success).toBe(false);
  });

  it("validates alert, watchlist and portfolio payloads with defaults", () => {
    expect(
      alertInputSchema.parse({
        symbol: "nvda",
        type: "ai-risk",
        label: "KI-Risikoalarm",
        condition: "Risiko > 70"
      })
    ).toMatchObject({ symbol: "NVDA", enabled: true });

    expect(alertUpdateInputSchema.parse({ id: "a1", enabled: false })).toEqual({
      id: "a1",
      enabled: false
    });
    expect(portfolioDeleteInputSchema.parse({ id: "p1" })).toEqual({ id: "p1" });
    expect(watchlistInputSchema.parse({ symbol: "voo" })).toEqual({ symbol: "VOO", assetType: "stock" });
    expect(watchlistInputSchema.parse({ symbol: "btc-usd", assetType: "crypto" })).toEqual({
      symbol: "BTC-USD",
      assetType: "crypto"
    });

    const trade = portfolioTradeInputSchema.parse({
      symbol: "msft",
      side: "buy",
      assetType: "stock",
      sector: "Software",
      quantity: 2,
      price: 450
    });

    expect(trade).toMatchObject({
      symbol: "MSFT",
      currency: "USD",
      riskScore: 55
    });
  });

  it("returns sanitized validation messages without leaking internals", () => {
    const invalidTrade = portfolioTradeInputSchema.safeParse({
      symbol: "nvda",
      side: "buy",
      assetType: "stock",
      sector: "Software",
      quantity: 0,
      price: -1
    });

    expect(invalidTrade.success).toBe(false);
    if (!invalidTrade.success) {
      expect(sanitizeError(invalidTrade.error)).toContain("Too small");
    }

    expect(sanitizeError(new Error("database secret"))).toBe("Anfrage konnte nicht verarbeitet werden.");
    expect(sanitizeError(new z.ZodError([]))).toBe("");
  });
});
