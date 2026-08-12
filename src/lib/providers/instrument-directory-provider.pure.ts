import type { MarketUniverseAssetClass } from "@/lib/types";

/**
 * Reine Ableitungsregeln des Instrument-Directory-Adapters.
 *
 * Bewusst ohne `server-only` und ohne Netzwerkcode, damit die Heuristik ohne
 * Provider-Zugriff testbar bleibt. Der eigentliche Adapter importiert von hier.
 */

/**
 * Assetklasse aus den Feldern ableiten, die FMP tatsaechlich liefert. Die Regeln
 * stammen aus beobachteten Antworten, nicht aus Annahmen (gemessen 2026-08-07):
 *   BTCUSD  -> exchange CRYPTO, exchangeFullName CCC
 *   EURUSD  -> exchange FOREX,  exchangeFullName CCY
 *   ^GSPC   -> exchange INDEX,  exchangeFullName SNP
 *   SPY     -> exchange AMEX,   Name enthaelt "ETF"
 *
 * FMP liefert kein explizites Typfeld. Die Ableitung ist daher eine Heuristik
 * und wird ueber `certain` als solche gekennzeichnet, damit der Instrument
 * Master die Konfidenz entsprechend senken kann.
 */
export function inferAssetClass(input: {
  symbol: string;
  name: string;
  exchange: string;
}): { assetClass: MarketUniverseAssetClass; certain: boolean } {
  const exchange = input.exchange.toUpperCase();
  const name = input.name.toLowerCase();

  if (exchange === "CRYPTO") return { assetClass: "crypto", certain: true };
  if (exchange === "FOREX") return { assetClass: "forex", certain: true };
  if (exchange === "INDEX") return { assetClass: "index", certain: true };
  if (exchange === "COMMODITY") return { assetClass: "commodity", certain: true };

  if (input.symbol.startsWith("^")) return { assetClass: "index", certain: true };

  // Namensheuristik. Bewusst konservativ: nur eindeutige Produktbezeichnungen.
  if (/\betf\b|\betn\b|\betc\b/.test(name)) return { assetClass: "etf", certain: false };
  if (/\bindex fund\b|\bmutual fund\b|\bfund\b/.test(name)) return { assetClass: "fund", certain: false };
  if (/\btrust\b/.test(name) && /\bbitcoin\b|\bethereum\b/.test(name)) {
    return { assetClass: "etf", certain: false };
  }

  return { assetClass: "stock", certain: false };
}

/**
 * Statischer Capability-Report fuer Admin- und Coverage-Ansichten.
 *
 * Bewusst ohne Netzwerkaufruf und ohne Secret-Zugriff, damit er in jeder Ansicht
 * ohne Quota-Verbrauch nutzbar und ohne Provider testbar ist.
 */
export function instrumentDirectoryCapabilityReport(searchAvailable: boolean) {
  return {
    provider: "FMP",
    directorySyncAvailable: false,
    searchAvailable,
    verifiedAt: "2026-08-07",
    blockedEndpoints: [
      { endpoint: "v3/stock/list", status: 403, reason: "Legacy-Endpunkt von FMP abgeschaltet" },
      { endpoint: "v3/etf/list", status: 403, reason: "Legacy-Endpunkt von FMP abgeschaltet" },
      { endpoint: "v3/available-traded/list", status: 403, reason: "Legacy-Endpunkt von FMP abgeschaltet" },
      { endpoint: "v3/symbol/available-*", status: 403, reason: "Legacy-Endpunkt von FMP abgeschaltet" },
      { endpoint: "stable/company-screener", status: 402, reason: "Nicht im aktiven Tarif" },
      { endpoint: "stable/available-exchanges", status: 402, reason: "Nicht im aktiven Tarif" },
      { endpoint: "stable/search-isin", status: 402, reason: "Nicht im aktiven Tarif" }
    ],
    availableEndpoints: [
      { endpoint: "stable/search-symbol", status: 200 },
      { endpoint: "stable/search-name", status: 200 }
    ],
    consequence:
      "Vollständige Instrumentabdeckung ist mit diesem Tarif technisch nicht erreichbar. Das Universum wächst suchgetrieben."
  } as const;
}
