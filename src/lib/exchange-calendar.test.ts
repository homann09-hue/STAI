import { describe, expect, it } from "vitest";
import {
  evaluateExchangeSession,
  normalizeFmpExchangeHolidays,
  normalizeFmpExchangeHours,
  normalizeLocalClock
} from "@/lib/exchange-calendar";

describe("exchange calendar normalization", () => {
  it("normalisiert 12- und 24-Stunden-Zeiten", () => {
    expect(normalizeLocalClock("9:30 a.m. ET")).toBe("09:30");
    expect(normalizeLocalClock("4:00 PM")).toBe("16:00");
    expect(normalizeLocalClock("25:00")).toBeNull();
  });

  it("verweigert einen Kalender ohne explizite Handelstage", () => {
    expect(normalizeFmpExchangeHours([{
      exchange: "NASDAQ",
      timezone: "America/New_York",
      openingHour: "09:30",
      closingHour: "16:00"
    }], "NASDAQ")).toBeNull();
  });

  it("normalisiert explizite Handelszeiten und Feiertage", () => {
    const hours = normalizeFmpExchangeHours([{
      exchange: "NASDAQ",
      name: "Nasdaq",
      timezone: "America/New_York",
      openingHour: "9:30 AM",
      closingHour: "4:00 PM",
      tradingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }], "NASDAQ");
    const holidays = normalizeFmpExchangeHolidays({ holidays: [{ date: "2026-12-25", name: "Christmas Day" }] });

    expect(hours?.regularSchedule).toHaveLength(5);
    expect(holidays.validResponse).toBe(true);
    expect(holidays.holidays[0]).toMatchObject({ date: "2026-12-25", isClosed: true });
  });
});

describe("exchange session evaluation", () => {
  const schedule = {
    timezone: "America/New_York",
    regularSchedule: [
      { weekday: 1 as const, openLocal: "09:30", closeLocal: "16:00" },
      { weekday: 5 as const, openLocal: "09:30", closeLocal: "16:00" }
    ],
    holidays: [],
    coverage: { hours: "available" as const, holidays: "available" as const }
  };

  it("meldet nur bei vollständiger Kalenderabdeckung offen", () => {
    const result = evaluateExchangeSession(schedule, new Date("2026-08-10T15:00:00.000Z"));
    expect(result.status).toBe("open");
    expect(result.localTime).toContain("America/New_York");
  });

  it("setzt einen Provider-Feiertag vor die regulären Zeiten", () => {
    const result = evaluateExchangeSession({
      ...schedule,
      holidays: [{ date: "2026-12-25", name: "Christmas Day", isClosed: true, openLocal: null, closeLocal: null }]
    }, new Date("2026-12-25T16:00:00.000Z"));
    expect(result.status).toBe("closed");
    expect(result.reason).toContain("Christmas Day");
  });

  it("bleibt bei fehlender Feiertagsabdeckung unbekannt", () => {
    const result = evaluateExchangeSession({
      ...schedule,
      coverage: { hours: "available", holidays: "unavailable" }
    }, new Date("2026-08-10T15:00:00.000Z"));
    expect(result.status).toBe("unknown");
  });
});
