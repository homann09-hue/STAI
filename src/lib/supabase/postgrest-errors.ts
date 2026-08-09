/**
 * Fehlerdeutung für PostgREST- und Postgres-Antworten.
 *
 * Herausgezogen aus `user-data.ts`, damit die Entscheidung prüfbar ist. Sie war
 * dort eine lokale Hilfsfunktion und damit der einzige Fix dieser Arbeitsphase
 * ohne Regressionstest — ausgerechnet der, der einen Produktionsfehler behoben
 * hat: `/api/account/export` antwortete mit 500, weil `billing_events` mangels
 * angewandter Migration fehlte.
 *
 * Reine Funktionen, kein Netzzugriff.
 */

export type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/** Postgres: `undefined_table`. */
const POSTGRES_UNDEFINED_TABLE = "42P01";

/** PostgREST spiegelt eine fehlende Relation je nach Version als eigenen Code. */
const POSTGREST_MISSING_TABLE = "PGRST205";

/** Postgres: `undefined_column`. Ein Schemafehler im Code, kein Betriebszustand. */
const POSTGRES_UNDEFINED_COLUMN = "42703";

/**
 * Bewusst eng: die Meldung muss von einer Relation oder Tabelle sprechen.
 *
 * Ein blosses "does not exist" reicht nicht — eine fehlende Spalte meldet
 * denselben Wortlaut. Genau das ist beim Schreiben des Tests aufgefallen: mit
 * der weiteren Fassung waere ein Schemafehler im Code als fehlende Migration
 * durchgegangen und haette eine still unvollstaendige DSGVO-Auskunft erzeugt.
 */
const MISSING_RELATION_MESSAGE = /(relation|table)\s+\S*\s*does not exist|could not find the table/i;

/**
 * Erkennt, dass eine Tabelle nicht existiert.
 *
 * Der Unterschied ist wichtig genug für eine eigene Funktion: eine fehlende
 * Tabelle ist ein Betriebszustand — eine Migration wurde noch nicht angewandt.
 * Jeder andere Datenbankfehler ist ein echter Fehler und darf nicht
 * stillschweigend zu einer leeren Liste werden.
 *
 * Die Textprüfung ist Absicht und kein Notbehelf: PostgREST liefert je nach
 * Version einen Code oder nur eine Meldung. Sie ist aber eng genug gefasst, um
 * einen Rechte- oder Syntaxfehler nicht mitzunehmen.
 */
export function isMissingRelationError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  // Eine fehlende Spalte hat Vorrang vor jeder Textpruefung: sie ist ein Fehler
  // im Code und darf niemals zu einer leeren Liste werden.
  if (error.code === POSTGRES_UNDEFINED_COLUMN) return false;
  if (error.code === POSTGRES_UNDEFINED_TABLE || error.code === POSTGREST_MISSING_TABLE) return true;
  return MISSING_RELATION_MESSAGE.test(error.message ?? "");
}
