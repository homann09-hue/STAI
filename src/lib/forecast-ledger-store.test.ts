import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { buildForecastLedgerResponse } from "./forecast-ledger";
import {
  buildForecastInsertPayload,
  buildForecastOutcomePayload,
  persistForecastLedgerResponse
} from "./forecast-ledger-store";

function cloneDetail(symbol: string): AssetDetail {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as AssetDetail;
}

describe("forecast ledger store", () => {
  it("maps a forecast response to a safe server-side insert payload", () => {
    const response = buildForecastLedgerResponse(cloneDetail("AAPL"), new Date("2026-08-06T12:00:00.000Z"));
    const payload = buildForecastInsertPayload(response);

    expect(payload.symbol).toBe("AAPL");
    expect(payload.model_key).toBe("stockpilot.forecast");
    expect(payload.input_hash).toBe(response.ledgerEntry.inputDigest);
    expect(payload.sources).toEqual(expect.arrayContaining(response.forecast.sources.slice(0, 1)));
    expect(JSON.stringify(payload)).not.toContain("SUPABASE");
  });

  it("builds no outcome placeholder for blocked forecasts", () => {
    const detail = cloneDetail("NVDA");
    detail.quote.quality = "unavailable";
    detail.dataQuality = {
      ...detail.dataQuality,
      confidence: 10,
      sufficientForAnalysis: false
    };
    const response = buildForecastLedgerResponse(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(response.ledgerEntry.outcomeStatus).toBe("blocked");
    expect(buildForecastOutcomePayload("forecast-id", response.ledgerEntry)).toBeNull();
  });

  it("skips persistence cleanly when no service client is configured", async () => {
    const response = buildForecastLedgerResponse(cloneDetail("MSFT"), new Date("2026-08-06T12:00:00.000Z"));

    const result = await persistForecastLedgerResponse(response, null);

    expect(result.status).toBe("skipped");
    expect(result.forecastId).toBeNull();
    expect(result.reason).toContain("nicht konfiguriert");
  });
});
