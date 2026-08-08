import { describe, expect, it } from "vitest";
import {
  buildQuotaStatus,
  nextQuotaReset,
  planWithHigherQuota,
  quotaFeatureNames,
  quotaHeaders,
  quotaLimitFor,
  secondsUntilReset
} from "@/lib/billing/usage-quota";
import { pricingTiers } from "@/lib/feature-gates";

/**
 * Die Quoten standen seit Beginn in den Tarifen und wirkten nirgends. Diese
 * Tests halten fest, was eine Grenze zu einer echten Grenze macht — und dass
 * die Ablehnung dem Nutzer sagt, wann und wodurch sie endet.
 */

const now = new Date("2026-08-08T14:30:00.000Z");

describe("quotaLimitFor", () => {
  it("liest die Grenzen aus der Tariftabelle", () => {
    expect(quotaLimitFor("free", "aiAnalysesPerDay")).toBe(3);
    expect(quotaLimitFor("starter", "aiAnalysesPerDay")).toBe(20);
    expect(quotaLimitFor("pro", "aiAnalysesPerDay")).toBe(100);
    expect(quotaLimitFor("free", "apiRequestsPerDay")).toBe(0);
  });
});

describe("planWithHigherQuota", () => {
  it("nennt den günstigsten Tarif mit echt höherer Grenze", () => {
    expect(planWithHigherQuota("free", "aiAnalysesPerDay")).toBe("starter");
    expect(planWithHigherQuota("starter", "aiAnalysesPerDay")).toBe("pro");
  });

  it("empfiehlt im höchsten Tarif kein Upgrade", () => {
    expect(planWithHigherQuota("elite", "aiAnalysesPerDay")).toBeNull();
  });

  it("bleibt an die Tariftabelle gebunden statt an eine zweite Liste", () => {
    // Wenn ein Tarif seine Grenze aendert, muss die Empfehlung mitziehen.
    for (const tier of pricingTiers) {
      const better = planWithHigherQuota(tier.id, "aiAnalysesPerDay");
      if (better === null) continue;
      const betterTier = pricingTiers.find((candidate) => candidate.id === better);
      expect(betterTier?.limits.aiAnalysesPerDay).toBeGreaterThan(tier.limits.aiAnalysesPerDay);
    }
  });
});

describe("nextQuotaReset", () => {
  it("setzt den Zähler zum nächsten UTC-Tagesbeginn zurück", () => {
    // UTC und nicht die Zeitzone des Aufrufers: eine Quote, die sich mit der
    // Zeitzone verschiebt, laesst sich durch eine geaenderte Systemzeit umgehen.
    expect(nextQuotaReset(now)).toBe("2026-08-09T00:00:00.000Z");
  });

  it("rechnet über den Monatswechsel hinweg", () => {
    expect(nextQuotaReset(new Date("2026-08-31T23:59:59.000Z"))).toBe("2026-09-01T00:00:00.000Z");
  });

  it("nennt nie null Sekunden bis zum Zurücksetzen", () => {
    // Ein Retry-After von 0 waere eine Einladung zur Endlosschleife.
    expect(secondsUntilReset(new Date("2026-08-08T23:59:59.900Z"))).toBeGreaterThanOrEqual(1);
  });
});

describe("buildQuotaStatus", () => {
  it("nennt Verbrauch, Grenze, Rest und Zeitpunkt der Rückkehr", () => {
    const status = buildQuotaStatus("aiAnalysesPerDay", "free", 3, 3, now);

    expect(status.used).toBe(3);
    expect(status.limit).toBe(3);
    expect(status.remaining).toBe(0);
    expect(status.resetsAt).toBe("2026-08-09T00:00:00.000Z");
  });

  it("weist auf den Tarif hin, der mehr erlaubt", () => {
    const status = buildQuotaStatus("aiAnalysesPerDay", "free", 3, 3, now);

    expect(status.upgradePlan).toBe("starter");
    expect(status.upgradeLimit).toBe(20);
    expect(status.message).toMatch(/Tageslimit von 3 KI-Analysen/);
    expect(status.message).toMatch(/Starter erlaubt 20 pro Tag/);
    expect(status.message).toMatch(/Morgen steht das Kontingent wieder zur Verfügung/);
  });

  it("unterscheidet „Kontingent aufgebraucht“ von „nicht im Tarif enthalten“", () => {
    // Free hat null API-Abrufe. Das ist kein erschoepftes Kontingent, sondern
    // eine Funktion, die der Tarif nicht enthaelt -- und "morgen wieder
    // verfuegbar" waere hier schlicht falsch.
    const status = buildQuotaStatus("apiRequestsPerDay", "free", 0, 0, now);

    expect(status.message).toMatch(/nicht enthalten/);
    expect(status.message).not.toMatch(/Morgen/);
    expect(status.upgradePlan).toBe("pro");
  });

  it("meldet keinen negativen Rest, wenn mehr gezählt wurde als erlaubt", () => {
    const status = buildQuotaStatus("aiAnalysesPerDay", "free", 9, 3, now);
    expect(status.remaining).toBe(0);
  });

  it("verträgt unsaubere Zahlen aus der Datenbank", () => {
    const status = buildQuotaStatus("aiAnalysesPerDay", "pro", -4, 100.7, now);
    expect(status.used).toBe(0);
    expect(status.limit).toBe(100);
  });
});

describe("quotaHeaders", () => {
  it("macht den Stand ohne Auswertung des Bodys sichtbar", () => {
    const headers = quotaHeaders(buildQuotaStatus("aiAnalysesPerDay", "starter", 5, 20, now));

    expect(headers["X-StockPilot-Quota-Limit"]).toBe("20");
    expect(headers["X-StockPilot-Quota-Remaining"]).toBe("15");
    expect(headers["X-StockPilot-Quota-Reset"]).toBe("2026-08-09T00:00:00.000Z");
  });
});

describe("quotaFeatureNames", () => {
  it("hält sich an das Namensformat der Datenbank", () => {
    // Die Tabelle prueft `^[a-z][a-z0-9_]{1,60}$`. Ein Name, der dort scheitert,
    // wuerde die Quote zur Laufzeit sprengen statt beim Test.
    for (const name of Object.values(quotaFeatureNames)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]{1,60}$/);
    }
  });
});
