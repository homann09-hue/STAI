import { inferAssetClass } from "@/lib/providers/instrument-directory-provider.pure";
import type { InstrumentResolutionStatus, MarketUniverseAssetClass } from "@/lib/types";

/**
 * Reine Identitaets- und Normalisierungslogik des Instrument Masters.
 *
 * Bewusst ohne I/O, ohne Supabase und ohne `server-only`: Domaenenlogik ist von
 * Persistenz getrennt und dadurch ohne Netzwerk, Datenbank oder Mocks testbar.
 */

export interface InstrumentIdentityInput {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetClass: MarketUniverseAssetClass;
  matchedVia: "symbol" | "name";
  assetClassEvidence?: "provider" | "heuristic";
}

export interface InstrumentIdentityAssessment {
  identityConfidence: number;
  resolutionStatus: InstrumentResolutionStatus;
  resolutionWarnings: string[];
}

function canonicalPart(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

/**
 * Kanonische ID nach demselben Schema wie `instrument-master.ts`, damit
 * persistierte und zur Laufzeit aufgeloeste Instrumente dieselbe Identitaet
 * teilen: assetClass:exchange:symbol:currency.
 *
 * Mehrfachlistings desselben Unternehmens bleiben absichtlich getrennt: AAPL an
 * der NASDAQ und AAPL.DE an der XETRA sind unterschiedliche Listings.
 */
export function buildCanonicalInstrumentId(input: {
  assetClass: string;
  exchange: string;
  symbol: string;
  currency: string;
}) {
  const exchange = canonicalPart(input.exchange, "unknown-exchange");
  const currency = canonicalPart(input.currency, "unknown-currency");
  return `${input.assetClass}:${exchange}:${input.symbol.toLowerCase()}:${currency}`;
}

/**
 * Bewertet, wie belastbar die Identitaet eines Provider-Treffers ist.
 *
 * Wichtig: FMP liefert kein Typfeld und in diesem Tarif keine ISIN. Ein Treffer
 * ohne eindeutige Boerse oder mit rein heuristisch abgeleiteter Assetklasse
 * bekommt daher eine niedrigere Konfidenz und wird nicht als aufgeloest
 * ausgegeben.
 */
export function assessInstrumentIdentity(input: InstrumentIdentityInput): InstrumentIdentityAssessment {
  const warnings: string[] = [];
  let confidence = 70;

  const exchangeKnown = input.exchange.trim().toLowerCase() !== "unknown" && input.exchange.trim() !== "";
  const certain = input.assetClassEvidence === "provider"
    ? true
    : inferAssetClass({
        symbol: input.symbol,
        name: input.name,
        exchange: input.exchange
      }).certain;

  if (!exchangeKnown) {
    confidence -= 25;
    warnings.push("Handelsplatz wurde vom Provider nicht eindeutig geliefert.");
  }

  if (certain) {
    confidence += 15;
  } else {
    confidence -= 10;
    warnings.push(
      "Assetklasse wurde heuristisch aus Name und Handelsplatz abgeleitet; der Provider lieferte kein belastbares Typfeld."
    );
  }

  if (input.matchedVia === "name") {
    confidence -= 5;
    warnings.push("Treffer stammt aus der Namenssuche und ist schwaechere Evidenz als ein Symboltreffer.");
  }

  // Ohne ISIN/FIGI bleibt jede Identitaet providergebunden. Das ist im aktuellen
  // Tarif nicht behebbar und muss sichtbar bleiben.
  warnings.push("Keine ISIN oder FIGI verfuegbar: Identitaet ist providergebunden.");

  confidence = Math.max(0, Math.min(100, confidence));

  const resolutionStatus: InstrumentResolutionStatus =
    confidence >= 80 && exchangeKnown ? "resolved" : confidence >= 45 ? "provider_only" : "ambiguous";

  return { identityConfidence: confidence, resolutionStatus, resolutionWarnings: warnings.slice(0, 6) };
}
