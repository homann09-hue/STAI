import type {
  CanonicalInstrument,
  InstrumentIdentifier,
  MarketUniverseAssetClass,
  ProviderInstrumentMapping,
} from "@/lib/types";

export interface CanonicalInstrumentInput {
  internalInstrumentId?: unknown;
  canonicalId: string;
  symbol: string;
  displaySymbol?: unknown;
  name: string;
  assetClass: MarketUniverseAssetClass;
  instrumentType?: unknown;
  exchangeName?: unknown;
  exchangeCode?: unknown;
  mic?: unknown;
  currency: string;
  country?: unknown;
  identifiers?: InstrumentIdentifier[];
  primaryProvider: string;
  tradingTimezone?: unknown;
  pricePrecision?: unknown;
  quantityPrecision?: unknown;
  isActive?: unknown;
  isDelisted?: unknown;
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
}

function precision(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 18
    ? value
    : null;
}

function identifierValue(
  identifiers: InstrumentIdentifier[],
  type: InstrumentIdentifier["type"],
) {
  return optionalText(
    identifiers.find((identifier) => identifier.type === type)?.value,
    120,
  );
}

function verifiedIdentifier(
  identifiers: InstrumentIdentifier[],
  type: InstrumentIdentifier["type"],
  pattern: RegExp,
) {
  const value = identifierValue(identifiers, type)?.toUpperCase() ?? null;
  return value && pattern.test(value) ? value : null;
}

function providerMappings(
  identifiers: InstrumentIdentifier[],
  primaryProvider: string,
  symbol: string,
  exchangeCode: string | null,
) {
  const mappings = new Map<string, ProviderInstrumentMapping>();

  for (const identifier of identifiers) {
    if (identifier.type !== "provider_symbol") continue;
    const providerId = optionalText(identifier.provider, 60);
    const providerSymbol = optionalText(identifier.value, 120);
    if (!providerId || !providerSymbol) continue;
    const mapping = { providerId, providerSymbol, exchangeCode };
    mappings.set(
      `${providerId}:${providerSymbol}:${exchangeCode ?? ""}`,
      mapping,
    );
  }

  const normalizedProvider = optionalText(primaryProvider, 60);
  if (normalizedProvider && symbol) {
    const key = `${normalizedProvider}:${symbol}:${exchangeCode ?? ""}`;
    if (!mappings.has(key)) {
      mappings.set(key, {
        providerId: normalizedProvider,
        providerSymbol: symbol,
        exchangeCode,
      });
    }
  }

  return [...mappings.values()];
}

export function buildCanonicalInstrument(
  input: CanonicalInstrumentInput,
): CanonicalInstrument {
  const identifiers = input.identifiers ?? [];
  const symbol = input.symbol.trim().toUpperCase();
  const exchangeCode = optionalText(input.exchangeCode, 32);
  const explicitMicCandidate =
    optionalText(input.mic, 12)?.toUpperCase() ?? null;
  const explicitMic =
    explicitMicCandidate && /^[A-Z0-9]{4}$/.test(explicitMicCandidate)
      ? explicitMicCandidate
      : null;
  const identifierMic = verifiedIdentifier(identifiers, "mic", /^[A-Z0-9]{4}$/);
  const active = typeof input.isActive === "boolean" ? input.isActive : null;
  const delisted =
    typeof input.isDelisted === "boolean" ? input.isDelisted : null;
  const contradictoryStatus = active === true && delisted === true;
  const knownAssetClasses: MarketUniverseAssetClass[] = [
    "stock",
    "etf",
    "crypto",
    "forex",
    "index",
    "commodity",
    "bond",
    "future",
    "option",
    "warrant",
    "fund",
  ];
  const instrumentType = knownAssetClasses.includes(
    input.instrumentType as MarketUniverseAssetClass,
  )
    ? (input.instrumentType as MarketUniverseAssetClass)
    : input.assetClass;

  return {
    internalInstrumentId: optionalText(input.internalInstrumentId, 64),
    canonicalId: input.canonicalId.trim(),
    symbol,
    displaySymbol: optionalText(input.displaySymbol, 48) ?? symbol,
    name: input.name.trim(),
    assetClass: input.assetClass,
    instrumentType,
    exchangeName: optionalText(input.exchangeName, 240),
    exchangeCode,
    mic: explicitMic ?? identifierMic,
    currency: input.currency.trim().toUpperCase(),
    country: optionalText(input.country, 3)?.toUpperCase() ?? null,
    isin: verifiedIdentifier(identifiers, "isin", /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/),
    figi: verifiedIdentifier(identifiers, "figi", /^BBG[A-Z0-9]{9}$/),
    providerMappings: providerMappings(
      identifiers,
      input.primaryProvider,
      symbol,
      exchangeCode,
    ),
    tradingTimezone: optionalText(input.tradingTimezone, 64),
    pricePrecision: precision(input.pricePrecision),
    quantityPrecision: precision(input.quantityPrecision),
    isActive: contradictoryStatus ? null : active,
    isDelisted: contradictoryStatus ? null : delisted,
  };
}
