import type {
  InstrumentAnalysisReadiness,
  InstrumentIdentifier,
  InstrumentResolutionStatus,
  MarketDataQuality,
  MarketUniverseInstrument
} from "@/lib/types";

const weakExchangeNames = new Set(["", "provider", "nicht geliefert", "unknown", "n/a"]);

const qualityRank: Record<MarketDataQuality, number> = {
  realtime: 6,
  near_realtime: 5,
  delayed: 4,
  historical: 3,
  mock: 2,
  unavailable: 1
};

const coverageRank: Record<MarketUniverseInstrument["coverage"], number> = {
  available: 4,
  prepared: 3,
  license_required: 2,
  provider_missing: 1
};

function cleanToken(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

function normalizeSearchText(value: unknown) {
  return cleanToken(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9./:-]+/g, " ")
    .trim();
}

export function normalizeInstrumentSymbol(symbol: unknown) {
  if (typeof symbol !== "string") return "";
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9./:-]/g, "").slice(0, 32);
}

function normalizeCanonicalPart(value: unknown, fallback: string) {
  return cleanToken(value, fallback)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || fallback;
}

function hasWeakExchange(exchange: string) {
  return weakExchangeNames.has(exchange.trim().toLowerCase());
}

function buildCanonicalId(item: MarketUniverseInstrument, normalizedSymbol: string) {
  const exchange = normalizeCanonicalPart(item.exchange, "unknown-exchange");
  const currency = normalizeCanonicalPart(item.currency, "unknown-currency");
  return `${item.assetClass}:${exchange}:${normalizedSymbol.toLowerCase()}:${currency}`;
}

function mergeIdentifiers(
  existing: InstrumentIdentifier[] | undefined,
  additional: InstrumentIdentifier[]
) {
  const byKey = new Map<string, InstrumentIdentifier>();

  [...(existing ?? []), ...additional].forEach((identifier) => {
    const value = cleanToken(identifier.value);
    if (!value) return;
    const normalized: InstrumentIdentifier = {
      ...identifier,
      value: identifier.type === "ticker" || identifier.type === "provider_symbol" ? value.toUpperCase() : value
    };
    byKey.set(`${normalized.type}:${normalized.value}:${normalized.provider ?? ""}`, normalized);
  });

  return [...byKey.values()].slice(0, 12);
}

function deriveIdentifiers(item: MarketUniverseInstrument, normalizedSymbol: string) {
  const identifiers: InstrumentIdentifier[] = [
    { type: "ticker", value: normalizedSymbol },
    { type: "provider_symbol", value: normalizedSymbol, provider: cleanToken(item.provider, "StockPilot") }
  ];

  if (!hasWeakExchange(item.exchange)) {
    identifiers.push({ type: "exchange", value: cleanToken(item.exchange, "unknown") });
  }

  return mergeIdentifiers(item.identifiers, identifiers);
}

function scoreInstrument(item: MarketUniverseInstrument, normalizedSymbol: string) {
  let score = 96;
  const warnings: string[] = [];

  if (!normalizedSymbol) {
    score = 0;
    warnings.push("Symbol fehlt oder enthält keine gültigen Zeichen.");
  }

  if (normalizedSymbol.length > 24) {
    score -= 10;
    warnings.push("Langes Symbol: Symbologie muss providerabhängig geprüft werden.");
  }

  if (hasWeakExchange(item.exchange)) {
    score -= 22;
    warnings.push("Börse/Handelsplatz wurde vom Provider nicht eindeutig geliefert.");
  }

  if (item.coverage === "license_required") {
    score -= 16;
    warnings.push("Realtime oder vollständige Marktdaten benötigen eine passende Börsenlizenz.");
  }

  if (item.coverage === "prepared") {
    score -= 18;
    warnings.push("Instrument ist vorbereitet, aber noch nicht durch einen Live-Provider bestätigt.");
  }

  if (item.coverage === "provider_missing" || item.quoteQuality === "unavailable") {
    score -= 24;
    warnings.push("Kein aktiver Datenprovider für Kursdaten verfügbar.");
  }

  if (item.assetClass === "crypto" && !/[-/:]/.test(normalizedSymbol)) {
    score -= 10;
    warnings.push("Krypto-Symbol ohne Quote-Währung kann uneindeutig sein.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    warnings: [...new Set([...(item.resolutionWarnings ?? []), ...warnings])]
  };
}

function statusFromScore(
  item: MarketUniverseInstrument,
  normalizedSymbol: string,
  score: number,
  duplicateCount: number
): InstrumentResolutionStatus {
  if (!normalizedSymbol || score < 30) return "invalid";
  if (duplicateCount > 1 || hasWeakExchange(item.exchange)) return "ambiguous";
  if (item.coverage === "prepared" || item.coverage === "provider_missing") return "provider_only";
  return "resolved";
}

function betterInstrument(a: MarketUniverseInstrument, b: MarketUniverseInstrument) {
  const aScore = (coverageRank[a.coverage] * 10) + qualityRank[a.quoteQuality] + (a.identityConfidence ?? 0) / 100;
  const bScore = (coverageRank[b.coverage] * 10) + qualityRank[b.quoteQuality] + (b.identityConfidence ?? 0) / 100;
  return bScore > aScore ? b : a;
}

function analysisReadiness(item: MarketUniverseInstrument): {
  status: InstrumentAnalysisReadiness;
  blockers: string[];
} {
  const blockers: string[] = [];

  if (item.resolutionStatus === "invalid") blockers.push("Instrument kann nicht eindeutig genutzt werden.");
  if (item.resolutionStatus === "ambiguous") blockers.push("Symbolkonflikt oder fehlender Handelsplatz muss geprüft werden.");
  if (item.coverage === "license_required") blockers.push("Börsen- oder Datenlizenz erforderlich.");
  if (item.coverage === "provider_missing") blockers.push("Kein aktiver Provider für diesen Datenbereich.");
  if (item.coverage === "prepared") blockers.push("Datenmodell vorbereitet, aber noch kein produktiver Anbieter bestätigt.");
  if (item.quoteQuality === "unavailable") blockers.push("Aktuelle Kursdaten nicht verfügbar.");
  if (item.quoteQuality === "mock") blockers.push("Nur Mock-/Demo-Daten verfügbar.");

  if (blockers.some((blocker) => blocker.includes("nicht eindeutig") || blocker.includes("Kein aktiver Provider") || blocker.includes("nicht verfügbar"))) {
    return { status: "blocked", blockers };
  }

  if (blockers.length || item.quoteQuality === "delayed" || item.quoteQuality === "historical") {
    return { status: "limited", blockers };
  }

  return { status: "ready", blockers };
}

function searchContext(item: MarketUniverseInstrument, query?: string) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 6) : [];
  const symbol = normalizeSearchText(item.symbol);
  const name = normalizeSearchText(item.name);
  const exchange = normalizeSearchText(item.exchange);
  const country = normalizeSearchText(item.country);
  const currency = normalizeSearchText(item.currency);
  const assetClass = normalizeSearchText(item.assetClass);
  const identifiers = (item.identifiers ?? []).map((identifier) => normalizeSearchText(identifier.value));
  const reasons = new Set<string>();
  let score = Math.round(item.identityConfidence ?? 0);

  if (!tokens.length) {
    reasons.add("Startuniversum");
    score += item.coverage === "available" ? 12 : 4;
  }

  tokens.forEach((token) => {
    if (symbol === token) {
      score += 60;
      reasons.add("Ticker passt exakt");
    } else if (symbol.includes(token)) {
      score += 34;
      reasons.add("Ticker enthält Suchbegriff");
    }

    if (identifiers.some((identifier) => identifier === token || identifier.includes(token))) {
      score += 42;
      reasons.add("Identifier passt");
    }

    if (name.includes(token)) {
      score += 24;
      reasons.add("Name passt");
    }

    if (exchange.includes(token)) {
      score += 14;
      reasons.add("Börse passt");
    }

    if (country.includes(token)) {
      score += 10;
      reasons.add("Land passt");
    }

    if (currency.includes(token)) {
      score += 8;
      reasons.add("Währung passt");
    }

    if (assetClass.includes(token)) {
      score += 12;
      reasons.add("Assetklasse passt");
    }
  });

  if (item.resolutionStatus === "ambiguous") reasons.add("Symbolkonflikt sichtbar");
  if (item.coverage === "license_required") reasons.add("Lizenzstatus sichtbar");
  if (item.quoteQuality === "unavailable") reasons.add("Datenlücke sichtbar");

  const readiness = analysisReadiness(item);

  return {
    searchScore: Math.max(0, Math.min(100, score)),
    matchReasons: [...reasons].slice(0, 5),
    detailHref: `/assets/${encodeURIComponent(item.symbol)}`,
    analysisReadiness: readiness.status,
    analysisBlockers: readiness.blockers.slice(0, 5)
  };
}

export function resolveInstrumentUniverse(
  instruments: MarketUniverseInstrument[],
  limit = 250
): MarketUniverseInstrument[] {
  const normalized = instruments.map((item) => {
    const normalizedSymbol = normalizeInstrumentSymbol(item.symbol);
    const displaySymbol = cleanToken(item.displaySymbol ?? item.symbol, normalizedSymbol);
    const canonicalId = buildCanonicalId(item, normalizedSymbol || displaySymbol);
    const { score, warnings } = scoreInstrument(item, normalizedSymbol);

    return {
      ...item,
      symbol: normalizedSymbol || displaySymbol,
      displaySymbol,
      normalizedSymbol,
      canonicalId,
      identifiers: deriveIdentifiers(item, normalizedSymbol || displaySymbol),
      identityConfidence: score,
      resolutionWarnings: warnings
    };
  });

  const duplicateCount = new Map<string, Set<string>>();
  normalized.forEach((item) => {
    const weakSafeKey = `${item.assetClass}:${item.normalizedSymbol}:${item.currency}`;
    const known = duplicateCount.get(weakSafeKey) ?? new Set<string>();
    known.add(item.canonicalId ?? `${item.assetClass}:${item.symbol}:${item.exchange}`);
    duplicateCount.set(weakSafeKey, known);
  });

  const resolved = normalized.map((item) => {
    const weakSafeKey = `${item.assetClass}:${item.normalizedSymbol}:${item.currency}`;
    const duplicateMatches = duplicateCount.get(weakSafeKey)?.size ?? 1;
    return {
      ...item,
      resolutionStatus: statusFromScore(item, item.normalizedSymbol ?? "", item.identityConfidence ?? 0, duplicateMatches)
    };
  });

  const byCanonical = new Map<string, MarketUniverseInstrument>();
  resolved.forEach((item) => {
    const existing = byCanonical.get(item.canonicalId ?? `${item.assetClass}:${item.symbol}:${item.exchange}`);
    if (!existing) {
      byCanonical.set(item.canonicalId ?? `${item.assetClass}:${item.symbol}:${item.exchange}`, item);
      return;
    }

    const winner = betterInstrument(existing, item);
    const mergedWarnings = [...new Set([...(existing.resolutionWarnings ?? []), ...(item.resolutionWarnings ?? [])])];
    const mergedIdentifiers = mergeIdentifiers(existing.identifiers, item.identifiers ?? []);
    byCanonical.set(winner.canonicalId ?? `${winner.assetClass}:${winner.symbol}:${winner.exchange}`, {
      ...winner,
      identifiers: mergedIdentifiers,
      resolutionWarnings: mergedWarnings,
      note: winner.note === existing.note && item.note !== existing.note ? `${winner.note} Zweite Quelle: ${item.provider}.` : winner.note
    });
  });

  return [...byCanonical.values()].slice(0, Math.max(1, Math.min(limit, 250)));
}

export function enrichInstrumentSearchResults(
  instruments: MarketUniverseInstrument[],
  query?: string,
  limit = 250
): MarketUniverseInstrument[] {
  return instruments
    .map((item) => ({
      ...item,
      ...searchContext(item, query)
    }))
    .sort((a, b) => {
      if ((b.searchScore ?? 0) !== (a.searchScore ?? 0)) return (b.searchScore ?? 0) - (a.searchScore ?? 0);
      return a.symbol.localeCompare(b.symbol);
    })
    .slice(0, Math.max(1, Math.min(limit, 250)));
}
