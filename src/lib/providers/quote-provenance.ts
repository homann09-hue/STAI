import type { NormalizedQuote } from "@/lib/types";

const SERVER_CACHE_SUFFIX = " (Server-Cache)";

function canonicalProviderName(provider: string) {
  const normalized = provider.trim();
  return normalized.endsWith(SERVER_CACHE_SUFFIX)
    ? normalized.slice(0, -SERVER_CACHE_SUFFIX.length)
    : normalized;
}

export function summarizeQuoteProviders(
  quotes: NormalizedQuote[],
  configuredProviderName: string,
) {
  const providers = [
    ...new Set(
      quotes
        .map((quote) => canonicalProviderName(quote.provider))
        .filter(Boolean),
    ),
  ];

  return {
    provider: providers.length ? providers.join(", ") : configuredProviderName,
    providers,
  };
}
