export type CorporateActionType =
  | "cash_dividend"
  | "special_dividend"
  | "stock_dividend"
  | "split"
  | "reverse_split"
  | "symbol_change"
  | "merger"
  | "spin_off"
  | "rights_issue"
  | "delisting";

export type CorporateActionLifecycle = "scheduled" | "effective" | "cancelled" | "unknown";
export type CorporateActionQuality =
  | "provider_reported"
  | "issuer_confirmed"
  | "regulatory_filing";

export interface CorporateAction {
  canonicalActionId: string;
  symbol: string;
  type: CorporateActionType;
  effectiveDate: string;
  announcementDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  oldSymbol: string | null;
  newSymbol: string | null;
  cashAmount: number | null;
  adjustedCashAmount: number | null;
  currency: string | null;
  ratioFrom: number | null;
  ratioTo: number | null;
  lifecycle: CorporateActionLifecycle;
  provider: string;
  sourceUrl: string;
  quality: CorporateActionQuality;
  asOf: string;
  receivedAt: string;
}

export interface CorporateActionCoverage {
  dividends: "available" | "unavailable";
  splits: "available" | "unavailable";
}

export interface CorporateActionsResult {
  symbol: string;
  actions: CorporateAction[];
  available: boolean;
  partial: boolean;
  provider: string | null;
  quality: CorporateActionQuality | "unavailable";
  retrievedAt: string;
  coverage: CorporateActionCoverage;
  note: string;
}

export function supportsCorporateActionsAssetType(assetType: unknown): assetType is "stock" | "etf" {
  return assetType === "stock" || assetType === "etf";
}

const PROVIDER = "Financial Modeling Prep";
const DIVIDEND_SOURCE = "https://site.financialmodelingprep.com/developer/docs/historical-stock-dividends-api/";
const SPLIT_SOURCE = "https://site.financialmodelingprep.com/developer/docs/stable/splits-company";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = record(entry);
    return parsed ? [parsed] : [];
  });
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

function currencyOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(normalized) ? normalized : null;
}

function eventTimestamp(date: string) {
  return `${date}T00:00:00.000Z`;
}

function lifecycleFor(date: string, now: Date): CorporateActionLifecycle {
  return date > now.toISOString().slice(0, 10) ? "scheduled" : "effective";
}

function canonicalNumber(value: number | null) {
  return value === null ? "none" : value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function ratioFromString(value: unknown): [number, number] | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const from = positiveOrNull(match[1]);
  const to = positiveOrNull(match[2]);
  return from !== null && to !== null ? [from, to] : null;
}

export function normalizeFmpDividends(
  raw: unknown,
  requestedSymbol: string,
  receivedAt: string,
  now = new Date(receivedAt)
): CorporateAction[] {
  const normalizedSymbol = requestedSymbol.trim().toUpperCase();

  return rows(raw).flatMap((entry): CorporateAction[] => {
    const effectiveDate = dateOrNull(entry.date ?? entry.exDividendDate);
    const cashAmount = nonNegativeOrNull(entry.dividend ?? entry.adjDividend);
    if (!effectiveDate || cashAmount === null) return [];

    const rowSymbol = typeof entry.symbol === "string" ? entry.symbol.trim().toUpperCase() : normalizedSymbol;
    if (rowSymbol !== normalizedSymbol) return [];

    const adjustedCashAmount = nonNegativeOrNull(entry.adjDividend);
    const currency = currencyOrNull(entry.currency);
    const announcementDate = dateOrNull(entry.declarationDate ?? entry.announcementDate);

    return [{
      canonicalActionId: [
        "fmp",
        "cash_dividend",
        normalizedSymbol,
        effectiveDate,
        canonicalNumber(cashAmount),
        currency ?? "unknown"
      ].join(":"),
      symbol: normalizedSymbol,
      type: "cash_dividend",
      effectiveDate,
      announcementDate,
      recordDate: dateOrNull(entry.recordDate),
      paymentDate: dateOrNull(entry.paymentDate),
      oldSymbol: null,
      newSymbol: null,
      cashAmount,
      adjustedCashAmount,
      currency,
      ratioFrom: null,
      ratioTo: null,
      lifecycle: lifecycleFor(effectiveDate, now),
      provider: PROVIDER,
      sourceUrl: DIVIDEND_SOURCE,
      quality: "provider_reported",
      asOf: eventTimestamp(announcementDate ?? effectiveDate),
      receivedAt
    }];
  });
}

export function normalizeFmpSplits(
  raw: unknown,
  requestedSymbol: string,
  receivedAt: string,
  now = new Date(receivedAt)
): CorporateAction[] {
  const normalizedSymbol = requestedSymbol.trim().toUpperCase();

  return rows(raw).flatMap((entry): CorporateAction[] => {
    const effectiveDate = dateOrNull(entry.date);
    const parsedRatio = ratioFromString(entry.splitRatio);
    const ratioFrom = positiveOrNull(entry.numerator) ?? parsedRatio?.[0] ?? null;
    const ratioTo = positiveOrNull(entry.denominator) ?? parsedRatio?.[1] ?? null;
    if (!effectiveDate || ratioFrom === null || ratioTo === null) return [];

    const rowSymbol = typeof entry.symbol === "string" ? entry.symbol.trim().toUpperCase() : normalizedSymbol;
    if (rowSymbol !== normalizedSymbol) return [];
    const type: CorporateActionType = ratioFrom < ratioTo ? "reverse_split" : "split";

    return [{
      canonicalActionId: [
        "fmp",
        type,
        normalizedSymbol,
        effectiveDate,
        canonicalNumber(ratioFrom),
        canonicalNumber(ratioTo)
      ].join(":"),
      symbol: normalizedSymbol,
      type,
      effectiveDate,
      announcementDate: dateOrNull(entry.declarationDate ?? entry.announcementDate),
      recordDate: dateOrNull(entry.recordDate),
      paymentDate: null,
      oldSymbol: null,
      newSymbol: null,
      cashAmount: null,
      adjustedCashAmount: null,
      currency: null,
      ratioFrom,
      ratioTo,
      lifecycle: lifecycleFor(effectiveDate, now),
      provider: PROVIDER,
      sourceUrl: SPLIT_SOURCE,
      quality: "provider_reported",
      asOf: eventTimestamp(effectiveDate),
      receivedAt
    }];
  });
}

export function mergeCorporateActions(...groups: readonly CorporateAction[][]): CorporateAction[] {
  const unique = new Map<string, CorporateAction>();
  for (const action of groups.flat()) unique.set(action.canonicalActionId, action);
  return [...unique.values()].sort((left, right) =>
    right.effectiveDate.localeCompare(left.effectiveDate)
  );
}
