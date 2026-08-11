import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  safeRedirectTarget,
  validateEmail,
  validatePassword,
  validatePasswordChange,
  validateRegistration
} from "@/lib/auth/credentials";

/**
 * Die Anmeldung ist die erste Seite, die ein fremder Mensch von StockPilot
 * sieht — und die einzige, die ein Angreifer garantiert erreicht. Die Tests
 * prüfen deshalb vor allem drei Dinge, die man im Browser schwer nachstellt:
 * offene Weiterleitungen, Kontoauskunft über Fehlermeldungen und Passwörter,
 * die der Anbieter später doch ablehnt.
 */

describe("E-Mail-Adressen", () => {
  it("nimmt an, was es wirklich gibt", () => {
    // Eine zu strenge Pruefung im Browser lehnt gueltige Adressen ab. Das
    // Pluszeichen und lange Endungen sind die haeufigsten Opfer.
    expect(validateEmail("angelo+stai@example.com")).toBeNull();
    expect(validateEmail("a@b.de")).toBeNull();
    expect(validateEmail("vorname.nachname@sub.example.museum")).toBeNull();
  });

  it("weist Unvollständiges zurück", () => {
    expect(validateEmail("")?.field).toBe("email");
    expect(validateEmail("kein-at-zeichen.de")).not.toBeNull();
    expect(validateEmail("zwei@@example.com")).not.toBeNull();
    expect(validateEmail("ohne@endung")).not.toBeNull();
  });

  it("begrenzt die Länge", () => {
    expect(validateEmail(`${"a".repeat(250)}@example.com`)).not.toBeNull();
  });
});

describe("Passwörter", () => {
  it("verlangt Länge statt Zeichenklassen", () => {
    // "Passwort1!" erfuellt jede Zeichenklassen-Regel und ist trotzdem
    // schlecht. Eine Wortfolge ist besser und faellt hier nicht durch.
    expect(validatePassword("korrekt pferd batterie klammer")).toBeNull();
    expect(validatePassword("Passwort1!")).toBeNull();
  });

  it("lehnt zu kurze ab, bevor der Anbieter es tut", () => {
    const issue = validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1));

    expect(issue?.field).toBe("password");
    expect(issue?.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("lehnt unsinnig lange ab", () => {
    expect(validatePassword("a".repeat(500))).not.toBeNull();
  });
});

describe("Registrierung", () => {
  it("nennt alle Probleme auf einmal", () => {
    // Fehler einzeln auszugeben zwingt den Nutzer durch mehrere Runden.
    const issues = validateRegistration("kaputt", "kurz", "anders");

    expect(issues.map((issue) => issue.field)).toContain("email");
    expect(issues.map((issue) => issue.field)).toContain("password");
  });

  it("merkt sich den Tippfehler in der Wiederholung", () => {
    const issues = validateRegistration("a@b.de", "korrekt pferd batterie", "korrekt pferd batterei");

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("confirm");
  });

  it("ist zufrieden, wenn alles stimmt", () => {
    expect(validateRegistration("a@b.de", "korrekt pferd batterie", "korrekt pferd batterie")).toEqual([]);
  });
});

describe("Passwortwechsel", () => {
  it("verlangt eine zweite Eingabe", () => {
    const issues = validatePasswordChange("korrekt pferd batterie", "");

    expect(issues).toEqual([
      { field: "confirm", message: "Bitte wiederholen Sie das neue Passwort." }
    ]);
  });

  it("verhindert Tippfehler beim Zurücksetzen", () => {
    const issues = validatePasswordChange("korrekt pferd batterie", "korrekt pferd batterei");

    expect(issues).toEqual([
      { field: "confirm", message: "Die beiden Passwörter stimmen nicht überein." }
    ]);
  });

  it("akzeptiert zwei identische sichere Passwörter", () => {
    expect(validatePasswordChange("korrekt pferd batterie", "korrekt pferd batterie")).toEqual([]);
  });
});

describe("Fehlermeldungen verraten keine Konten", () => {
  it("unterscheidet nicht zwischen falschem Passwort und fehlendem Konto", () => {
    // Sonst ist die Anmeldemaske eine Kontoauskunft: durchprobieren verraet,
    // welche Adressen registriert sind.
    const message = describeAuthError("invalid_credentials", "Invalid login credentials");

    expect(message).toBe("E-Mail-Adresse oder Passwort stimmen nicht.");
    expect(message).not.toMatch(/nicht registriert|unbekannt|existiert/i);
  });

  it("nennt die Bestätigungsmail beim Namen", () => {
    expect(describeAuthError("email_not_confirmed", "Email not confirmed")).toMatch(/bestätigen/i);
  });

  it("erklärt eine Sperre nach zu vielen Versuchen", () => {
    expect(describeAuthError("over_email_send_rate_limit", "rate limit")).toMatch(/Zu viele Versuche/);
  });

  it("reicht Unbekanntes durch, statt es zu verschlucken", () => {
    // Eine Fehlermeldung, die nichts sagt, kostet den Nutzer mehr als eine, die
    // er nachschlagen kann.
    expect(describeAuthError("etwas_neues", "Unexpected provider failure")).toBe("Unexpected provider failure");
    expect(describeAuthError(undefined, "")).toMatch(/nicht durchgelaufen/);
  });
});

describe("Weiterleitung nach der Anmeldung", () => {
  it("erlaubt interne Ziele", () => {
    expect(safeRedirectTarget("/portfolio")).toBe("/portfolio");
    expect(safeRedirectTarget("/assets/AAPL?tab=risk")).toBe("/assets/AAPL?tab=risk");
  });

  it("lässt keine fremde Seite zu", () => {
    // Der Angriff: ein Anmeldelink, der nach echter Anmeldung auf eine Kopie
    // der Seite fuehrt. Der Nutzer hat sich korrekt angemeldet und ist trotzdem
    // woanders.
    expect(safeRedirectTarget("https://fremde-seite.example")).toBe("/");
    expect(safeRedirectTarget("//fremde-seite.example")).toBe("/");
    expect(safeRedirectTarget("/\\fremde-seite.example")).toBe("/");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/");
  });

  it("fällt ohne Angabe auf das Ziel zurück", () => {
    expect(safeRedirectTarget(null)).toBe("/");
    expect(safeRedirectTarget(null, "/watchlist")).toBe("/watchlist");
  });
});
