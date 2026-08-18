/**
 * Zentrale, provider-unabhängige Routing- und Lizenzentscheidung.
 *
 * Das Modul kennt ausschließlich Konfiguration und Fähigkeiten. Secret-Werte
 * werden weder zurückgegeben noch geloggt. Adapter bleiben in ihren jeweiligen
 * Provider-Modulen.
 */

export type ProviderId =
  | "alpaca"
  | "twelve_data"
  | "finnhub"
  | "fmp"
  | "alpha_vantage"
  | "massive"
  | "eodhd"
  | "databento"
  | "binance"
  | "coinbase"
  | "marketaux"
  | "newsapi"
  | "sec_edgar"
  | "fred"
  | "ecb"
  | "coingecko";

export type ProviderCapability =
  | "quote"
  | "quote_batch"
  | "stream_quotes"
  | "stream_trades"
  | "historical_bars"
  | "instrument_search"
  | "market_status"
  | "fundamentals"
  | "corporate_actions"
  | "market_calendar"
  | "company_profile"
  | "earnings_calendar"
  | "analyst_consensus"
  | "price_target"
  | "insider_transactions"
  | "economic_calendar"
  | "news"
  | "filings"
  | "macro"
  | "crypto_metadata";

export type ProviderAssetClass =
  | "equity"
  | "etf"
  | "index"
  | "crypto"
  | "forex"
  | "macro";

export type MarketDataEnvironment =
  | "development"
  | "test"
  | "preview"
  | "production";

export type ProviderUsage =
  | "internal"
  | "external_display"
  | "redistribution"
  | "derived_data";

export type ProviderFeedType =
  | "realtime"
  | "near_realtime"
  | "delayed"
  | "reference"
  | "unknown";

export type ProviderHealthState =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "open_circuit"
  | "unknown";

export type ProviderLicensePolicy = {
  providerId: ProviderId;
  environment: MarketDataEnvironment;
  internalUseAllowed: boolean;
  externalDisplayAllowed: boolean;
  redistributionAllowed: boolean;
  derivedDataAllowed: boolean;
  attributionRequired: boolean;
  maximumKnownDelay: number | null;
  feedType: ProviderFeedType;
  licenseVerified: boolean;
  licenseVerifiedAt: string | null;
  notes: string;
};

type ProviderDefinition = {
  id: ProviderId;
  name: string;
  adapterStatus: "implemented" | "prepared";
  capabilities: readonly ProviderCapability[];
  assetClasses: readonly ProviderAssetClass[];
  configurationEnv: readonly string[];
  enableEnv: string;
  feedType: ProviderFeedType;
  maximumKnownDelay: number | null;
  attributionRequired: boolean;
  officialPublicSource?: boolean;
};

const ALL_MARKET_ASSETS: readonly ProviderAssetClass[] = [
  "equity",
  "etf",
  "index",
  "crypto",
  "forex",
];

export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    id: "alpaca",
    name: "Alpaca",
    adapterStatus: "implemented",
    capabilities: [
      "quote",
      "quote_batch",
      "stream_quotes",
      "stream_trades",
      "historical_bars",
      "market_status",
    ],
    assetClasses: ["equity", "etf"],
    configurationEnv: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_ALPACA",
    feedType: "realtime",
    maximumKnownDelay: 0,
    attributionRequired: true,
  },
  {
    id: "twelve_data",
    name: "Twelve Data",
    adapterStatus: "implemented",
    capabilities: [
      "quote",
      "quote_batch",
      "stream_quotes",
      "historical_bars",
      "instrument_search",
      "market_status",
    ],
    assetClasses: ALL_MARKET_ASSETS,
    configurationEnv: ["TWELVE_DATA_API_KEY", "TWELVEDATA_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_TWELVE_DATA",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "finnhub",
    name: "Finnhub",
    adapterStatus: "implemented",
    capabilities: [
      "quote",
      "quote_batch",
      "stream_trades",
      "historical_bars",
      "instrument_search",
      "company_profile",
      "earnings_calendar",
      "analyst_consensus",
      "price_target",
      "insider_transactions",
      "economic_calendar",
      "news",
    ],
    assetClasses: ["equity", "etf", "index", "forex", "crypto"],
    configurationEnv: ["FINNHUB_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_FINNHUB",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "fmp",
    name: "Financial Modeling Prep",
    adapterStatus: "implemented",
    capabilities: [
      "quote",
      "quote_batch",
      "historical_bars",
      "instrument_search",
      "fundamentals",
      "corporate_actions",
      "market_calendar",
      "news",
    ],
    assetClasses: ALL_MARKET_ASSETS,
    configurationEnv: ["FMP_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_FMP",
    feedType: "delayed",
    maximumKnownDelay: 900,
    attributionRequired: true,
  },
  {
    id: "alpha_vantage",
    name: "Alpha Vantage",
    adapterStatus: "implemented",
    capabilities: ["quote", "quote_batch", "fundamentals"],
    assetClasses: ["equity", "etf", "forex", "crypto"],
    configurationEnv: ["ALPHA_VANTAGE_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_ALPHA_VANTAGE",
    feedType: "delayed",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "massive",
    name: "Massive / Polygon",
    adapterStatus: "implemented",
    capabilities: ["quote", "quote_batch"],
    assetClasses: ["equity", "etf", "index", "forex", "crypto"],
    configurationEnv: ["MASSIVE_API_KEY", "POLYGON_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_MASSIVE",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "eodhd",
    name: "EODHD",
    adapterStatus: "implemented",
    capabilities: ["quote", "quote_batch"],
    assetClasses: ALL_MARKET_ASSETS,
    configurationEnv: ["EODHD_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_EODHD",
    feedType: "delayed",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "databento",
    name: "Databento",
    adapterStatus: "prepared",
    capabilities: ["quote", "quote_batch", "stream_quotes", "historical_bars"],
    assetClasses: ["equity", "etf", "index", "forex"],
    configurationEnv: ["DATABENTO_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_DATABENTO",
    feedType: "realtime",
    maximumKnownDelay: 0,
    attributionRequired: true,
  },
  {
    id: "binance",
    name: "Binance",
    adapterStatus: "implemented",
    capabilities: ["quote", "quote_batch"],
    assetClasses: ["crypto"],
    configurationEnv: [],
    enableEnv: "MARKET_DATA_ENABLE_BINANCE",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "coinbase",
    name: "Coinbase",
    adapterStatus: "implemented",
    capabilities: ["quote", "quote_batch", "stream_quotes"],
    assetClasses: ["crypto"],
    configurationEnv: [],
    enableEnv: "MARKET_DATA_ENABLE_COINBASE",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "marketaux",
    name: "Marketaux",
    adapterStatus: "implemented",
    capabilities: ["news"],
    assetClasses: ["equity", "etf", "index", "crypto", "forex"],
    configurationEnv: ["MARKETAUX_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_MARKETAUX",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "newsapi",
    name: "NewsAPI",
    adapterStatus: "implemented",
    capabilities: ["news"],
    assetClasses: ["equity", "etf", "index", "crypto", "forex"],
    configurationEnv: ["NEWS_API_KEY", "NEWSAPI_API_KEY"],
    enableEnv: "MARKET_DATA_ENABLE_NEWSAPI",
    feedType: "near_realtime",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "sec_edgar",
    name: "SEC EDGAR",
    adapterStatus: "implemented",
    capabilities: ["filings"],
    assetClasses: ["equity", "etf"],
    configurationEnv: ["SEC_CONTACT_EMAIL", "SEC_EDGAR_USER_AGENT"],
    enableEnv: "MARKET_DATA_ENABLE_SEC",
    feedType: "reference",
    maximumKnownDelay: null,
    attributionRequired: true,
    officialPublicSource: true,
  },
  {
    id: "fred",
    name: "FRED",
    adapterStatus: "implemented",
    capabilities: ["macro"],
    assetClasses: ["macro"],
    configurationEnv: [],
    enableEnv: "MARKET_DATA_ENABLE_FRED",
    feedType: "reference",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
  {
    id: "ecb",
    name: "European Central Bank",
    adapterStatus: "implemented",
    capabilities: ["macro"],
    assetClasses: ["macro"],
    configurationEnv: [],
    enableEnv: "MARKET_DATA_ENABLE_ECB",
    feedType: "reference",
    maximumKnownDelay: null,
    attributionRequired: true,
    officialPublicSource: true,
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    adapterStatus: "implemented",
    capabilities: ["crypto_metadata"],
    assetClasses: ["crypto"],
    configurationEnv: [],
    enableEnv: "MARKET_DATA_ENABLE_COINGECKO",
    feedType: "reference",
    maximumKnownDelay: null,
    attributionRequired: true,
  },
] as const;

const providerIds = new Set<ProviderId>(
  PROVIDER_DEFINITIONS.map((provider) => provider.id),
);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizedEnvironment(
  value: string | undefined,
): MarketDataEnvironment | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "development" ||
    normalized === "test" ||
    normalized === "preview" ||
    normalized === "production"
    ? normalized
    : null;
}

export function getMarketDataEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): MarketDataEnvironment {
  const vercelEnvironment = normalizedEnvironment(env.VERCEL_ENV);
  if (
    vercelEnvironment === "production" ||
    vercelEnvironment === "preview"
  ) {
    return vercelEnvironment;
  }
  if (normalizedEnvironment(env.NODE_ENV) === "production") {
    return "production";
  }
  return (
    normalizedEnvironment(env.MARKET_DATA_ENV) ??
    vercelEnvironment ??
    normalizedEnvironment(env.NODE_ENV) ??
    "development"
  );
}

export type MarketDataRuntimeConfig = {
  environment: MarketDataEnvironment;
  defaultProvider: ProviderId | null;
  allowExternalDisplay: boolean;
  staleAfterMs: number;
  retryAttempts: number;
  crosscheckProviderCount: number;
};

export function normalizeProviderId(
  value: string | undefined,
): ProviderId | null {
  const normalized = value?.trim().toLowerCase().replaceAll("-", "_");
  if (!normalized || normalized === "auto") return null;
  if (normalized === "polygon") return "massive";
  if (normalized === "news_api") return "newsapi";
  return providerIds.has(normalized as ProviderId)
    ? (normalized as ProviderId)
    : null;
}

export function getMarketDataRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MarketDataRuntimeConfig {
  return {
    environment: getMarketDataEnvironment(env),
    defaultProvider: normalizeProviderId(
      env.MARKET_DATA_DEFAULT_PROVIDER ??
        env.MARKET_DATA_PROVIDER ??
        env.STOCKPILOT_MARKET_PROVIDER ??
        env.STOCKPILOT_QUOTE_PROVIDER,
    ),
    allowExternalDisplay: parseBoolean(
      env.MARKET_DATA_ALLOW_EXTERNAL_DISPLAY,
      false,
    ),
    staleAfterMs: parsePositiveInteger(
      env.MARKET_DATA_STALE_AFTER_MS,
      120_000,
    ),
    retryAttempts: Math.min(
      parsePositiveInteger(env.MARKET_DATA_RETRY_ATTEMPTS, 2),
      5,
    ),
    crosscheckProviderCount: Math.min(
      parsePositiveInteger(env.MARKET_DATA_CROSSCHECK_PROVIDER_COUNT, 2),
      4,
    ),
  };
}

function definitionFor(id: ProviderId): ProviderDefinition {
  const definition = PROVIDER_DEFINITIONS.find(
    (provider) => provider.id === id,
  );
  if (!definition) throw new Error(`Unbekannter Provider: ${id}`);
  return definition;
}

function isConfigured(
  definition: ProviderDefinition,
  env: NodeJS.ProcessEnv,
): boolean {
  if (!definition.configurationEnv.length) return true;
  if (definition.id === "alpaca") {
    return definition.configurationEnv.every((key) =>
      Boolean(env[key]?.trim()),
    );
  }
  return definition.configurationEnv.some((key) => Boolean(env[key]?.trim()));
}

function isEnabled(
  definition: ProviderDefinition,
  env: NodeJS.ProcessEnv,
): boolean {
  return parseBoolean(env[definition.enableEnv], true);
}

export function getProviderLicensePolicy(
  providerId: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): ProviderLicensePolicy {
  const definition = definitionFor(providerId);
  const environment = getMarketDataEnvironment(env);
  const verifiedProviders = parseCsv(
    env.MARKET_DATA_LICENSE_VERIFIED_PROVIDERS,
  );
  const externallyAllowedProviders = parseCsv(
    env.MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS,
  );
  const verifiedByDeployment = verifiedProviders.has(providerId);
  const alpacaFeed = (env.ALPACA_DATA_FEED ?? "iex").trim().toLowerCase();
  const feedType =
    definition.id === "alpaca"
      ? alpacaFeed === "delayed_sip"
        ? "delayed"
        : alpacaFeed === "iex" || alpacaFeed === "sip"
          ? "realtime"
          : "unknown"
      : definition.feedType;
  const maximumKnownDelay =
    definition.id === "alpaca" && alpacaFeed === "delayed_sip"
      ? 900
      : definition.maximumKnownDelay;
  const licenseVerified = verifiedByDeployment;
  const externalDisplayAllowed =
    parseBoolean(env.MARKET_DATA_ALLOW_EXTERNAL_DISPLAY, false) &&
      verifiedByDeployment &&
      externallyAllowedProviders.has(providerId);

  return {
    providerId,
    environment,
    internalUseAllowed: true,
    externalDisplayAllowed,
    redistributionAllowed: false,
    derivedDataAllowed: verifiedByDeployment,
    attributionRequired: definition.attributionRequired,
    maximumKnownDelay,
    feedType,
    licenseVerified,
    licenseVerifiedAt: verifiedByDeployment
      ? (env.MARKET_DATA_LICENSE_VERIFIED_AT ?? null)
      : null,
    notes: definition.id === "alpaca" && alpacaFeed === "iex"
      ? "IEX ist ein einzelner Handelsplatz und kein konsolidierter US-Gesamtmarkt; externe Anzeige bleibt bis zur Rechteprüfung gesperrt."
      : definition.officialPublicSource
      ? "Offizielle öffentliche Quelle; externe Anzeige bleibt bis zur dokumentierten Rechteprüfung gesperrt."
      : licenseVerified
        ? "Nutzungsrechte wurden deploymentseitig bestätigt; der konkrete Tarif bleibt maßgeblich."
        : "Kostenloser oder unbekannter Tarif: interne Entwicklung erlaubt, externe Anzeige bis zur Rechteprüfung gesperrt.",
  };
}

function usageAllowed(
  policy: ProviderLicensePolicy,
  usage: ProviderUsage,
): boolean {
  if (usage === "internal") return policy.internalUseAllowed;
  if (usage === "external_display") return policy.externalDisplayAllowed;
  if (usage === "redistribution") return policy.redistributionAllowed;
  return policy.derivedDataAllowed;
}

const ROUTING_PRIORITY: Record<
  ProviderCapability,
  readonly ProviderId[]
> = {
  quote: [
    "alpaca",
    "twelve_data",
    "finnhub",
    "massive",
    "eodhd",
    "fmp",
    "alpha_vantage",
  ],
  quote_batch: [
    "alpaca",
    "twelve_data",
    "finnhub",
    "massive",
    "eodhd",
    "fmp",
    "alpha_vantage",
  ],
  stream_quotes: ["alpaca", "coinbase", "twelve_data", "databento"],
  stream_trades: ["alpaca", "finnhub"],
  historical_bars: ["alpaca", "twelve_data", "finnhub", "databento", "fmp"],
  instrument_search: ["twelve_data", "finnhub", "fmp"],
  market_status: ["alpaca", "twelve_data"],
  fundamentals: ["fmp", "alpha_vantage"],
  corporate_actions: ["fmp"],
  market_calendar: ["fmp"],
  company_profile: ["finnhub"],
  earnings_calendar: ["finnhub"],
  analyst_consensus: ["finnhub"],
  price_target: ["finnhub"],
  insider_transactions: ["finnhub"],
  economic_calendar: ["finnhub"],
  news: ["marketaux", "newsapi", "finnhub", "fmp"],
  filings: ["sec_edgar"],
  macro: ["fred", "ecb"],
  crypto_metadata: ["coingecko"],
};

const US_QUOTE_PRIORITY: readonly ProviderId[] = [
  "alpaca",
  "twelve_data",
  "finnhub",
  "massive",
  "eodhd",
  "fmp",
  "alpha_vantage",
];
const GLOBAL_QUOTE_PRIORITY: readonly ProviderId[] = [
  "twelve_data",
  "finnhub",
  "fmp",
  "massive",
  "eodhd",
  "alpha_vantage",
];
const CRYPTO_QUOTE_PRIORITY: readonly ProviderId[] = [
  "coinbase",
  "binance",
  "twelve_data",
  "finnhub",
  "fmp",
  "alpha_vantage",
];

export type ProviderRouteRequest = {
  capability: ProviderCapability;
  assetClass?: ProviderAssetClass;
  market?: "us" | "global";
  preferredProvider?: string | null;
  usage?: ProviderUsage;
  health?: Partial<Record<ProviderId, ProviderHealthState>>;
};

export type ProviderRouteRejection = {
  providerId: string;
  reason:
    | "unknown_provider"
    | "adapter_not_implemented"
    | "capability_not_supported"
    | "asset_class_not_supported"
    | "missing_configuration"
    | "disabled"
    | "license_not_verified"
    | "unhealthy";
  detail: string;
};

export type ProviderRouteDecision = {
  capability: ProviderCapability;
  assetClass: ProviderAssetClass | null;
  environment: MarketDataEnvironment;
  usage: ProviderUsage;
  providers: ProviderId[];
  rejected: ProviderRouteRejection[];
  failoverEnabled: boolean;
};

function routePriority(
  request: ProviderRouteRequest,
): readonly ProviderId[] {
  if (
    (request.capability === "quote" ||
      request.capability === "quote_batch") &&
    request.assetClass === "crypto"
  ) {
    return CRYPTO_QUOTE_PRIORITY;
  }
  if (
    (request.capability === "quote" ||
      request.capability === "quote_batch") &&
    request.market === "us"
  ) {
    return US_QUOTE_PRIORITY;
  }
  if (
    (request.capability === "quote" ||
      request.capability === "quote_batch") &&
    request.market === "global"
  ) {
    return GLOBAL_QUOTE_PRIORITY;
  }
  return ROUTING_PRIORITY[request.capability];
}

export function resolveProviderRoute(
  request: ProviderRouteRequest,
  env: NodeJS.ProcessEnv = process.env,
): ProviderRouteDecision {
  const runtime = getMarketDataRuntimeConfig(env);
  const usage =
    request.usage ??
    (runtime.environment === "production" ||
    runtime.environment === "preview"
      ? "external_display"
      : "internal");
  const requestedRaw = request.preferredProvider?.trim() || null;
  const preferred =
    normalizeProviderId(requestedRaw ?? undefined) ??
    (!requestedRaw ? runtime.defaultProvider : null);
  const rejected: ProviderRouteRejection[] = [];

  if (
    requestedRaw &&
    requestedRaw.toLowerCase() !== "auto" &&
    !preferred
  ) {
    rejected.push({
      providerId: requestedRaw,
      reason: "unknown_provider",
      detail: "Der angeforderte Provider ist nicht registriert.",
    });
  }

  const candidates = requestedRaw && requestedRaw.toLowerCase() !== "auto" && !preferred
    ? []
    : [
    ...new Set([
      ...(preferred ? [preferred] : []),
      ...routePriority(request),
    ]),
      ];
  const accepted: Array<{
    id: ProviderId;
    health: ProviderHealthState;
    order: number;
  }> = [];

  candidates.forEach((id, order) => {
    const definition = definitionFor(id);
    if (definition.adapterStatus !== "implemented") {
      rejected.push({
        providerId: id,
        reason: "adapter_not_implemented",
        detail: `${definition.name} ist registriert, aber der Adapter ist noch nicht implementiert.`,
      });
      return;
    }
    if (!definition.capabilities.includes(request.capability)) {
      rejected.push({
        providerId: id,
        reason: "capability_not_supported",
        detail: `${definition.name} unterstützt ${request.capability} in StockPilot nicht.`,
      });
      return;
    }
    if (
      request.assetClass &&
      !definition.assetClasses.includes(request.assetClass)
    ) {
      rejected.push({
        providerId: id,
        reason: "asset_class_not_supported",
        detail: `${definition.name} unterstützt ${request.assetClass} in StockPilot nicht.`,
      });
      return;
    }
    if (!isEnabled(definition, env)) {
      rejected.push({
        providerId: id,
        reason: "disabled",
        detail: `${definition.enableEnv}=false.`,
      });
      return;
    }
    if (!isConfigured(definition, env)) {
      rejected.push({
        providerId: id,
        reason: "missing_configuration",
        detail: `Serverseitige Konfiguration für ${definition.name} fehlt.`,
      });
      return;
    }
    const policy = getProviderLicensePolicy(id, env);
    if (!usageAllowed(policy, usage)) {
      rejected.push({
        providerId: id,
        reason: "license_not_verified",
        detail: `${usage} ist für ${definition.name} nicht verifiziert.`,
      });
      return;
    }
    const health = request.health?.[id] ?? "unknown";
    if (health === "unavailable" || health === "open_circuit") {
      rejected.push({
        providerId: id,
        reason: "unhealthy",
        detail: `${definition.name} ist aktuell ${health}.`,
      });
      return;
    }
    accepted.push({ id, health, order });
  });

  accepted.sort(
    (left, right) =>
      (left.health === "degraded" ? 1 : 0) -
        (right.health === "degraded" ? 1 : 0) ||
      left.order - right.order,
  );

  return {
    capability: request.capability,
    assetClass: request.assetClass ?? null,
    environment: runtime.environment,
    usage,
    providers: accepted.map((entry) => entry.id),
    rejected,
    failoverEnabled: accepted.length > 1,
  };
}

export function getProviderRegistrySnapshot(
  env: NodeJS.ProcessEnv = process.env,
) {
  return {
    generatedAt: new Date().toISOString(),
    runtime: getMarketDataRuntimeConfig(env),
    providers: PROVIDER_DEFINITIONS.map((definition) => ({
      id: definition.id,
      name: definition.name,
      adapterStatus: definition.adapterStatus,
      capabilities: [...definition.capabilities],
      assetClasses: [...definition.assetClasses],
      configured: isConfigured(definition, env),
      enabled: isEnabled(definition, env),
      requiredConfiguration: [...definition.configurationEnv],
      license: getProviderLicensePolicy(definition.id, env),
    })),
  };
}

export function providerDisplayName(id: ProviderId): string {
  return definitionFor(id).name;
}
