import { describe, expect, it } from "vitest";
import { APP_DISPLAY_TIME_ZONE, formatGermanDate, formatGermanDateTime } from "@/lib/date-time";

describe("deterministische deutsche Datumsanzeige", () => {
  it("verwendet unabhängig vom Serverstandort die festgelegte Produkt-Zeitzone", () => {
    expect(APP_DISPLAY_TIME_ZONE).toBe("Europe/Berlin");
    expect(
      formatGermanDateTime("2026-01-01T23:30:00.000Z", {
        dateStyle: "short",
        timeStyle: "medium"
      })
    ).toBe("02.01.26, 00:30:00");
  });

  it("verschiebt UTC-Zeitpunkte bei der Anzeige korrekt auf den Berliner Kalendertag", () => {
    expect(formatGermanDate("2026-01-01T23:30:00.000Z")).toBe("02.01.26");
  });

  it("zeigt bei ungültigen oder fehlenden Daten keine erfundene Zeit", () => {
    expect(formatGermanDateTime("invalid")).toBe("nicht verfügbar");
    expect(formatGermanDate(null)).toBe("—");
  });
});

