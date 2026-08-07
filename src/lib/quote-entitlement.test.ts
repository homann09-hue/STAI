import { describe, expect, it } from "vitest";
import {
  isQuoteStatusConfirmed,
  quoteStatusFromHttpStatus,
  quoteStatusFromProviderError,
  shouldRecheckQuoteStatus
} from "./quote-entitlement";

describe("quoteStatusFromHttpStatus", () => {
  it("wertet 402 und 403 als dauerhafte Tarifsperre", () => {
    expect(quoteStatusFromHttpStatus(402)).toBe("restricted");
    expect(quoteStatusFromHttpStatus(403)).toBe("restricted");
  });

  it("wertet 200 als bestaetigte Verfuegbarkeit", () => {
    expect(quoteStatusFromHttpStatus(200)).toBe("available");
  });

  it("markiert Betriebsfehler nicht als Sperre", () => {
    // Ein 500er oder Timeout darf ein Instrument nicht dauerhaft als gesperrt
    // kennzeichnen, sonst verschwindet es faelschlich aus der Analyse.
    expect(quoteStatusFromHttpStatus(500)).toBe("error");
    expect(quoteStatusFromHttpStatus(429)).toBe("error");
    expect(quoteStatusFromHttpStatus(0)).toBe("error");
  });
});

describe("quoteStatusFromProviderError", () => {
  it("erkennt die FMP-Tarifsperre in der Fehlermeldung", () => {
    expect(quoteStatusFromProviderError(new Error("FMP HTTP 402"))).toBe("restricted");
    expect(quoteStatusFromProviderError(new Error("FMP HTTP 403"))).toBe("restricted");
  });

  it("behandelt Timeouts als Betriebsfehler", () => {
    expect(quoteStatusFromProviderError(new Error("The operation was aborted"))).toBe("error");
    expect(quoteStatusFromProviderError(null)).toBe("error");
  });
});

describe("isQuoteStatusConfirmed", () => {
  it("behandelt ungeprueft und Fehler nie als belastbar", () => {
    expect(isQuoteStatusConfirmed("unknown")).toBe(false);
    expect(isQuoteStatusConfirmed("error")).toBe(false);
    expect(isQuoteStatusConfirmed("available")).toBe(true);
    expect(isQuoteStatusConfirmed("restricted")).toBe(true);
  });
});

describe("shouldRecheckQuoteStatus", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  it("prueft ungepruefte und fehlerhafte Instrumente immer erneut", () => {
    expect(shouldRecheckQuoteStatus("unknown", null, now)).toBe(true);
    expect(shouldRecheckQuoteStatus("error", "2026-08-07T11:59:00.000Z", now)).toBe(true);
  });

  it("prueft bestaetigte Verfuegbarkeit taeglich nach", () => {
    expect(shouldRecheckQuoteStatus("available", "2026-08-07T06:00:00.000Z", now)).toBe(false);
    expect(shouldRecheckQuoteStatus("available", "2026-08-05T06:00:00.000Z", now)).toBe(true);
  });

  it("prueft Tarifsperren seltener nach, weil sie sich selten aendern", () => {
    expect(shouldRecheckQuoteStatus("restricted", "2026-08-03T12:00:00.000Z", now)).toBe(false);
    expect(shouldRecheckQuoteStatus("restricted", "2026-07-20T12:00:00.000Z", now)).toBe(true);
  });

  it("prueft erneut, wenn der Zeitstempel unbrauchbar ist", () => {
    expect(shouldRecheckQuoteStatus("available", "kein-datum", now)).toBe(true);
    expect(shouldRecheckQuoteStatus("restricted", null, now)).toBe(true);
  });
});
