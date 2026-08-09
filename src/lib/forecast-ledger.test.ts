import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { buildForecastLedgerEntry, buildForecastLedgerResponse } from "./forecast-ledger";
import { buildForecastPassport } from "./forecast-passport";

function cloneDetail(symbol: string): AssetDetail {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as AssetDetail;
}

describe("forecast ledger", () => {
  it("creates deterministic ledger ids for identical forecast inputs", () => {
    const detail = cloneDetail("AAPL");
    const now = new Date("2026-08-06T12:00:00.000Z");
    const forecast = buildForecastPassport(detail, now);

    const first = buildForecastLedgerEntry(detail, forecast, now);
    const second = buildForecastLedgerEntry(detail, forecast, now);

    expect(first.id).toBe(second.id);
    expect(first.inputDigest).toBe(second.inputDigest);
    expect(first.modelVersion).toBe(forecast.modelVersion);
    expect(first.dataCutoff).toBe(forecast.dataCutoff);
  });

  it("rejects blocked forecasts instead of storing them as approved signals", () => {
    const detail = cloneDetail("NVDA");
    detail.quote.quality = "unavailable";
    detail.dataQuality = {
      ...detail.dataQuality,
      confidence: 10,
      score: 20,
      sufficientForAnalysis: false,
      issues: ["Kursdaten fehlen."]
    };
    const response = buildForecastLedgerResponse(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(response.forecast.status).toBe("blocked");
    expect(response.ledgerEntry.promotionGate).toBe("rejected");
    expect(response.ledgerEntry.outcomeStatus).toBe("blocked");
    expect(response.ledgerEntry.evaluationDueAt).toBeNull();
    expect(response.ledgerEntry.decisionReason).toContain("blockiert");
  });

  it("adds outcome evaluation metadata for allowed or restricted forecasts", () => {
    const detail = cloneDetail("MSFT");
    detail.quote.quality = "delayed";

    const response = buildForecastLedgerResponse(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(response.ledgerEntry.outcomeStatus).toBe("pending");
    expect(response.ledgerEntry.evaluationDueAt).toBeTruthy();
    expect(response.evaluationPlan.baseline).toContain("naive");
    expect(response.evaluationPlan.storageStatus).toBe("database_required");
    expect(response.provenance.symbol).toBe("MSFT");
  });
});
