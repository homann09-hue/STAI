/**
 * Prüfung von Anmeldedaten — rein, ohne Netz und ohne React.
 *
 * Getrennt vom Formular, weil genau hier die Fehler sitzen, die man im
 * Browser nur schwer nachstellt: ein Passwort, das die Anforderungen erfüllt,
 * aber vom Anbieter abgelehnt wird; eine Fehlermeldung, die verrät, ob eine
 * E-Mail-Adresse registriert ist.
 */

export type CredentialIssue = { field: "email" | "password" | "confirm"; message: string };

/**
 * Mindestlänge.
 *
 * Supabase lehnt unter 6 Zeichen serverseitig ab. Hier stehen 10, weil eine
 * Anwendung mit Zahlungsdaten dahinter keine sechsstelligen Passwörter
 * anbieten sollte — und weil eine Regel, die erst der Server durchsetzt, dem
 * Nutzer eine unnötige Runde kostet.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 254;

/**
 * Bewusst nachsichtig.
 *
 * Eine strenge Adressprüfung im Browser lehnt gültige Adressen ab — Pluszeichen,
 * neue Endungen, Unicode. Ob die Adresse existiert, weiß ohnehin erst die
 * Bestätigungsmail.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): CredentialIssue | null {
  const email = raw.trim();

  if (!email) return { field: "email", message: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  if (email.length > MAX_EMAIL_LENGTH) {
    return { field: "email", message: "Diese E-Mail-Adresse ist zu lang." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { field: "email", message: "Diese E-Mail-Adresse sieht nicht vollständig aus." };
  }

  return null;
}

export function validatePassword(password: string): CredentialIssue | null {
  if (!password) return { field: "password", message: "Bitte wählen Sie ein Passwort." };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      field: "password",
      message: `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { field: "password", message: "Das Passwort ist zu lang." };
  }

  // Keine Zeichenklassen-Pflicht. Sie erzwingt "Passwort1!" und macht Passwoerter
  // messbar schlechter als eine reine Laengenanforderung.
  return null;
}

export function validatePasswordConfirmation(password: string, confirm: string): CredentialIssue | null {
  if (!confirm) {
    return { field: "confirm", message: "Bitte wiederholen Sie das neue Passwort." };
  }

  if (confirm !== password) {
    return { field: "confirm", message: "Die beiden Passwörter stimmen nicht überein." };
  }

  return null;
}

export function validatePasswordChange(password: string, confirm: string): CredentialIssue[] {
  return [validatePassword(password), validatePasswordConfirmation(password, confirm)].filter(
    (issue): issue is CredentialIssue => issue !== null
  );
}

export function validateRegistration(email: string, password: string, confirm: string): CredentialIssue[] {
  return [validateEmail(email), ...validatePasswordChange(password, confirm)].filter(
    (issue): issue is CredentialIssue => issue !== null
  );
}

/**
 * Übersetzt Anbieterfehler in Sätze, die einem Menschen helfen.
 *
 * Die wichtigste Regel steht in der Behandlung von `user_already_registered`:
 * Supabase liefert diesen Fall, und ihn direkt anzuzeigen wäre eine
 * **Kontoauskunft**. Jeder könnte damit durchprobieren, welche Adressen
 * registriert sind. Die Registrierung meldet deshalb in beiden Fällen dasselbe:
 * „Sehen Sie in Ihr Postfach."
 */
export function describeAuthError(code: string | undefined, message: string): string {
  switch (code) {
    case "invalid_credentials":
    case "invalid_grant":
      // Bewusst ohne Unterscheidung zwischen "Konto gibt es nicht" und
      // "Passwort falsch" -- sonst ist die Anmeldemaske eine Kontoauskunft.
      return "E-Mail-Adresse oder Passwort stimmen nicht.";
    case "email_not_confirmed":
      return "Bitte bestätigen Sie zuerst den Link in Ihrer E-Mail.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Zu viele Versuche in kurzer Zeit. Bitte warten Sie einen Moment.";
    case "weak_password":
      return `Dieses Passwort ist zu schwach. Mindestens ${MIN_PASSWORD_LENGTH} Zeichen, gern eine Wortfolge.`;
    case "same_password":
      return "Das neue Passwort ist mit dem alten identisch.";
    case "validation_failed":
      return "Bitte prüfen Sie Ihre Eingaben.";
    default:
      // Der Rohtext des Anbieters ist englisch und oft technisch. Er wird
      // trotzdem durchgereicht statt verschluckt: eine Fehlermeldung, die
      // nichts sagt, kostet den Nutzer mehr als eine, die er googeln kann.
      return message || "Die Anfrage ist nicht durchgelaufen. Bitte versuchen Sie es erneut.";
  }
}

/**
 * Wohin nach der Anmeldung.
 *
 * Nur anwendungsinterne Pfade. Ein `?next=https://fremde-seite.example` wäre
 * eine offene Weiterleitung: ein Angreifer schickt einen Anmeldelink, der nach
 * echter Anmeldung auf seine Kopie der Seite führt.
 */
export function safeRedirectTarget(raw: string | null, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  // "//host" waere protokollrelativ und damit extern.
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;

  return raw;
}
