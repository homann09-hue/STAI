import {
  normalizeProviderId,
  resolveProviderRoute,
  type ProviderId,
} from "@/lib/providers/provider-registry";

export type MarketProviderId =
  | "mock"
  | "unavailable"
  | "finnhub"
  | "twelve_data"
  | "eodhd"
  | "massive"
  | "polygon"
  | "fmp"
  | "alpha_vantage"
  | "databento"
  | "binance"
  | "coinbase";

export type QuoteChainEnv = Record<string, string | undefined>;

export type QuoteChain = {
  providers: MarketProviderId[];
  hasFailover: boolean;
  note: string;
};

function asMarketProviderId(id: ProviderId): MarketProviderId | null {
  return id === "finnhub" ||
    id === "twelve_data" ||
    id === "eodhd" ||
    id === "massive" ||
    id === "fmp" ||
    id === "alpha_vantage" ||
    id === "databento" ||
    id === "binance" ||
    id === "coinbase"
    ? id
    : null;
}

/**
 * Kompatibilitätsfassade für die zentrale Provider Registry.
 *
 * Die Quote-Kette entscheidet nicht mehr selbst über Schlüssel oder
 * Reihenfolgen. Sie übersetzt nur noch die Registry-Entscheidung in das
 * bestehende Adapterformat.
 */
export function resolveQuoteChain(
  env: QuoteChainEnv = process.env,
): QuoteChain {
  const explicitRaw =
    env.MARKET_DATA_DEFAULT_PROVIDER ??
    env.MARKET_DATA_PROVIDER ??
    env.STOCKPILOT_MARKET_PROVIDER ??
    env.STOCKPILOT_QUOTE_PROVIDER;
  const explicit = explicitRaw?.trim().toLowerCase();

  if (explicit === "mock") {
    return {
      providers: [],
      hasFailover: false,
      note: "Mock wurde ausdrücklich gewählt; keine echten Quellen werden abgefragt.",
    };
  }

  const normalized = normalizeProviderId(explicitRaw);
  const assetClass =
    normalized === "binance" || normalized === "coinbase"
      ? "crypto"
      : "equity";
  const decision = resolveProviderRoute(
    {
      capability: "quote",
      assetClass,
      preferredProvider: explicitRaw,
    },
    env as NodeJS.ProcessEnv,
  );
  const providers = decision.providers.flatMap((id) => {
    const adapterId = asMarketProviderId(id);
    return adapterId ? [adapterId] : [];
  });

  if (providers.length === 0) {
    const rightsBlocked = decision.rejected.some(
      (entry) => entry.reason === "license_not_verified",
    );
    return {
      providers,
      hasFailover: false,
      note: rightsBlocked
        ? "Keine externen Kursrechte verifiziert; Produktion bleibt geschlossen und erzeugt keine Ersatzkurse."
        : "Keine echten Kursanbieter konfiguriert; Produktion bleibt geschlossen und erzeugt keine Ersatzkurse.",
    };
  }

  if (providers.length === 1) {
    return {
      providers,
      hasFailover: false,
      note: `${providers[0]} ist die einzige konfigurierte Quelle und hat keinen echten Ersatz.`,
    };
  }

  return {
    providers,
    hasFailover: true,
    note: `Rangfolge: ${providers.join(" → ")}. Bei Ausfall wird die nächste Quelle versucht; Produktion erzeugt keine Ersatzkurse.`,
  };
}

export function primaryQuoteProvider(
  env: QuoteChainEnv = process.env,
): MarketProviderId | null {
  return resolveQuoteChain(env).providers[0] ?? null;
}
