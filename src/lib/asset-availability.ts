import type { QuoteStatus } from "@/lib/quote-entitlement";

/**
 * Warum eine Instrumentdetailseite keine Daten zeigen kann.
 *
 * Der Unterschied ist fuer den Nutzer wesentlich: „nicht verifiziert" und
 * „existiert, aber dein Tarif deckt es nicht ab" sind grundverschiedene
 * Aussagen. Solange der Katalog unvollstaendig ist, waere ein 404 ohne
 * Providerbeleg eine falsche Sicherheit.
 */
export type AssetUnavailabilityReason =
  | "identity_unverified"
  | "quote_not_entitled"
  | "provider_error";

export interface KnownInstrumentIdentity {
  symbol: string;
  name: string;
  assetClass: string;
  exchange: string;
  currency: string;
  provider: string;
  quoteStatus: QuoteStatus;
}

export interface AssetUnavailability {
  reason: AssetUnavailabilityReason;
  httpStatus: number;
  message: string;
  /** Was trotzdem bekannt ist. Leer, wenn das Instrument wirklich unbekannt ist. */
  identity: KnownInstrumentIdentity | null;
  /** Konkreter naechster Schritt statt einer Sackgasse. */
  remediation: string | null;
}

/**
 * Entscheidet, welche Auskunft der Nutzer bekommt, wenn kein Asset-Detail
 * geladen werden konnte.
 *
 * Bewusst als reine Funktion: die Entscheidung ist Produktlogik und muss ohne
 * Datenbank oder Provider testbar sein.
 */
export function resolveAssetUnavailability(input: {
  symbol: string;
  known: KnownInstrumentIdentity | null;
}): AssetUnavailability {
  const { known } = input;

  if (!known) {
    return {
      reason: "identity_unverified",
      httpStatus: 503,
      message: `${input.symbol} konnte im unvollständigen Instrumentkatalog derzeit nicht verifiziert werden.`,
      identity: null,
      remediation:
        "Prüfe die Schreibweise oder suche nach dem vollständigen Namen. Ohne vollständigen Verzeichnis-Sync behauptet StockPilot nicht, dass das Instrument nicht existiert."
    };
  }

  if (known.quoteStatus === "restricted") {
    return {
      reason: "quote_not_entitled",
      // 404 waere falsch: das Instrument existiert nachweislich im Instrument
      // Master. 403 beschreibt die tatsaechliche Ursache — fehlende Berechtigung.
      httpStatus: 403,
      message: `${known.symbol} existiert, wird aber vom aktiven Datentarif nicht abgedeckt.`,
      identity: known,
      remediation:
        "Der Providertarif gibt für dieses Symbol keinen Kurs frei. Identität, Handelsplatz und Währung bleiben verfügbar; Kurs- und Analysedaten nicht."
    };
  }

  // Bekannt, aber der Abruf schlug aus einem anderen Grund fehl. Nicht als
  // Tarifsperre darstellen, weil das ein voruebergehender Zustand sein kann.
  return {
    reason: "provider_error",
    httpStatus: 503,
    message: `${known.symbol} ist derzeit nicht abrufbar.`,
    identity: known,
    remediation: "Vorübergehendes Providerproblem. Ein späterer Versuch kann erfolgreich sein."
  };
}
