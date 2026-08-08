import { describe, expect, it } from "vitest";
import { isMissingRelationError } from "@/lib/supabase/postgrest-errors";

/**
 * Regressionstest für einen Produktionsfehler: `/api/account/export` antwortete
 * mit 500, weil `billing_events` mangels angewandter Migration fehlte. Eine
 * DSGVO-Auskunft darf an einer fehlenden Tabelle nicht vollständig scheitern —
 * der Nutzer bekommt seine übrigen Daten plus einen sichtbaren Hinweis.
 *
 * Der Test hat zwei Seiten, und die zweite ist die wichtigere: eine fehlende
 * Tabelle wird geschluckt, **jeder andere Fehler nicht**. Wäre die Erkennung zu
 * weit gefasst, würde ein Rechtefehler zu einer leeren Liste — und die Auskunft
 * wäre still unvollständig, statt laut zu scheitern.
 */

describe("isMissingRelationError", () => {
  it("erkennt den Postgres-Code für eine fehlende Tabelle", () => {
    expect(isMissingRelationError({ code: "42P01", message: null })).toBe(true);
  });

  it("erkennt den PostgREST-Code für eine fehlende Tabelle", () => {
    expect(isMissingRelationError({ code: "PGRST205", message: null })).toBe(true);
  });

  it("erkennt die Meldung, wenn kein Code mitkommt", () => {
    // PostgREST liefert je nach Version nur den Text.
    expect(isMissingRelationError({ message: 'relation "public.billing_events" does not exist' })).toBe(true);
    expect(
      isMissingRelationError({ message: "Could not find the table 'public.forecasts' in the schema cache" })
    ).toBe(true);
  });

  it("schluckt keinen Rechtefehler", () => {
    // Das ist der gefaehrliche Fall: wuerde er als fehlende Tabelle gelten,
    // bekaeme der Nutzer eine leere, still unvollstaendige Auskunft.
    expect(isMissingRelationError({ code: "42501", message: "permission denied for table entitlements" })).toBe(
      false
    );
  });

  it("schluckt keinen Verbindungs- oder Syntaxfehler", () => {
    expect(isMissingRelationError({ code: "42601", message: "syntax error at or near" })).toBe(false);
    expect(isMissingRelationError({ code: "08006", message: "connection failure" })).toBe(false);
  });

  it("schluckt keine fehlende Spalte", () => {
    // Dieser Fall hat beim Schreiben des Tests einen echten Mangel aufgedeckt:
    // die urspruengliche Textpruefung suchte nur nach "does not exist", und
    // eine fehlende Spalte meldet denselben Wortlaut. Ein Schemafehler im Code
    // waere damit als fehlende Migration durchgegangen -- und die
    // DSGVO-Auskunft still unvollstaendig geworden.
    expect(isMissingRelationError({ code: "42703", message: 'column "plan" of relation does not exist' })).toBe(
      false
    );
    // Auch ohne Code darf der Spaltenfall nicht greifen.
    expect(isMissingRelationError({ message: 'column "plan" does not exist' })).toBe(false);
  });

  it("verträgt einen fehlenden Fehler", () => {
    expect(isMissingRelationError(null)).toBe(false);
    expect(isMissingRelationError(undefined)).toBe(false);
    expect(isMissingRelationError({})).toBe(false);
  });
});
