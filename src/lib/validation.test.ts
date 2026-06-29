import { describe, expect, it } from "vitest";
import { validateSymbol } from "@/lib/validation";

describe("input validation", () => {
  it("accepts normal market symbols", () => {
    expect(validateSymbol("btc-usd").success).toBe(true);
    expect(validateSymbol("NVDA").success).toBe(true);
  });

  it("rejects unsafe symbols", () => {
    expect(validateSymbol("<script>").success).toBe(false);
    expect(validateSymbol("AAPL/../../secret").success).toBe(false);
  });
});
