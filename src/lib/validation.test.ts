import { describe, expect, it } from "vitest";
import {
  alertInputSchema,
  normalizeSymbolInput,
  portfolioDeleteInputSchema,
  portfolioTradeInputSchema,
  validateSymbol
} from "@/lib/validation";

describe("input validation", () => {
  it("accepts normal market symbols", () => {
    expect(validateSymbol("btc-usd").success).toBe(true);
    expect(validateSymbol("NVDA").success).toBe(true);
  });

  it("rejects unsafe symbols", () => {
    expect(validateSymbol("<script>").success).toBe(false);
    expect(validateSymbol("AAPL/../../secret").success).toBe(false);
    expect(normalizeSymbolInput("AAPL<script>").ok).toBe(false);
  });

  it("rejects unsafe alert and portfolio payloads", () => {
    expect(
      alertInputSchema.safeParse({
        symbol: "NVDA",
        type: "price",
        label: "Kursalarm",
        condition: "<img src=x onerror=alert(1)>",
        enabled: true
      }).success
    ).toBe(false);

    expect(
      portfolioTradeInputSchema.safeParse({
        symbol: "MSFT",
        side: "buy",
        assetType: "stock",
        sector: "Software <script>",
        quantity: 1,
        price: 500,
        currency: "USD",
        riskScore: 55
      }).success
    ).toBe(false);

    expect(portfolioDeleteInputSchema.safeParse({ id: "../../secret" }).success).toBe(false);
  });
});
