import "server-only";

import { analyzePortfolio } from "@/lib/portfolio-analytics";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AlertFrequency, AlertNotificationChannel, AlertRule, AlertType, AssetType, PortfolioPosition, PortfolioSummary, PortfolioTradeInput } from "@/lib/types";

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type AuthResult =
  | { ok: true; supabase: SupabaseClient; userId: string; email: string | null; accessToken: string }
  | { ok: false; reason: "missing_client" | "anonymous" | "invalid_token" };

type AlertRuleRow = {
  id: string;
  symbol: string;
  alert_type: AlertType | string | null;
  condition: unknown;
  enabled: boolean;
};

type PortfolioBookRow = {
  id: string;
  name: string;
  base_currency: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type PortfolioPositionRow = {
  id: string;
  symbol: string;
  name: string | null;
  asset_type: AssetType | string | null;
  sector: string;
  quantity: string | number;
  average_price: string | number;
  current_price: string | number | null;
  currency: string;
  risk_score: number | null;
};

type WatchlistRow = {
  id: string;
  symbol: string;
  asset_type: AssetType | string | null;
  created_at: string;
};

const alertLabels: Record<AlertType, string> = {
  price: "Kursalarm",
  rsi: "RSI über/unter Wert",
  news: "Newsalarm",
  volume: "Volumenanstieg",
  earnings: "Earnings Reminder",
  "ai-risk": "KI-Risikoalarm",
  "ai-shift": "KI-Einschätzung verändert",
  "portfolio-risk": "Portfolio-Risikoalarm"
};

const validAlertTypes = new Set<AlertType>([
  "price",
  "rsi",
  "news",
  "volume",
  "earnings",
  "ai-risk",
  "ai-shift",
  "portfolio-risk"
]);

const validAlertFrequencies = new Set<AlertFrequency>(["manual", "10s", "30s", "60s", "5min"]);
const validNotificationChannels = new Set<AlertNotificationChannel>(["none", "in_app", "push", "email", "webhook"]);
const validAssetTypes = new Set<string>(["stock", "etf", "crypto", "forex", "index"]);

function stripUnsafeTextChars(value: string) {
  let next = "";

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127 || char === "<" || char === ">") continue;
    next += char;
  }

  return next.replace(/\s+/g, " ").trim();
}

function safeProfileText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = stripUnsafeTextChars(value).slice(0, maxLength);

  return cleaned || null;
}

function safeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  return stripUnsafeTextChars(value).slice(0, maxLength) || fallback;
}

function safeRecordId(value: unknown) {
  return safeText(value, "", 96);
}

function safeSymbol(value: unknown) {
  if (typeof value !== "string") return "UNKNOWN";

  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9._:/=^+-]/g, "")
    .slice(0, 32);

  return normalized || "UNKNOWN";
}

function safeCurrency(value: unknown) {
  if (typeof value !== "string") return "USD";

  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  return normalized.length === 3 ? normalized : "USD";
}

function safeFiniteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, safeFiniteNumber(value, fallback)));
}

function safeAssetType(value: unknown): AssetType {
  return validAssetTypes.has(String(value)) ? (value as AssetType) : "stock";
}

function safeAlertType(value: unknown): AlertType {
  return validAlertTypes.has(value as AlertType) ? (value as AlertType) : "price";
}

function safeAlertFrequency(value: unknown): AlertFrequency | undefined {
  return validAlertFrequencies.has(value as AlertFrequency) ? (value as AlertFrequency) : undefined;
}

function safeNotificationChannel(value: unknown): AlertNotificationChannel | undefined {
  return validNotificationChannels.has(value as AlertNotificationChannel) ? (value as AlertNotificationChannel) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function portfolioBookFromRow(row: PortfolioBookRow): PortfolioBookRow {
  return {
    id: safeRecordId(row.id),
    name: safeText(row.name, "Portfolio", 80),
    base_currency: safeCurrency(row.base_currency),
    is_default: row.is_default === true,
    created_at: safeText(row.created_at, new Date(0).toISOString(), 40),
    updated_at: safeText(row.updated_at, new Date(0).toISOString(), 40)
  };
}

export async function getSupabaseAuth(request: Request): Promise<AuthResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, reason: "missing_client" };

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";

  if (!token) return { ok: false, reason: "anonymous" };

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, reason: "invalid_token" };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email: safeProfileText(data.user.email, 254),
    display_name:
      safeProfileText(data.user.user_metadata?.name, 80) ??
      safeProfileText(data.user.email?.split("@")[0], 80)
  });

  if (profileError) {
    logEvent("warn", "supabase.profile_upsert_failed", {
      code: profileError.code,
      message: profileError.message
    });
  }

  return {
    ok: true,
    supabase,
    userId: data.user.id,
    email: data.user.email ?? null,
    accessToken: token
  };
}

function alertFromRow(row: AlertRuleRow): AlertRule {
  const alertType = safeAlertType(row.alert_type);
  const condition = isRecord(row.condition) ? row.condition : {};

  return {
    id: safeRecordId(row.id),
    symbol: safeSymbol(row.symbol),
    type: alertType,
    label: safeText(condition.label, alertLabels[alertType] ?? "Alarm", 90),
    condition: safeText(condition.text, "Bedingung gespeichert", 140),
    enabled: row.enabled,
    threshold: Number.isFinite(Number(condition.threshold)) ? Number(condition.threshold) : undefined,
    frequency: safeAlertFrequency(condition.frequency),
    notificationChannel: safeNotificationChannel(condition.notificationChannel)
  };
}

function positionFromRow(row: PortfolioPositionRow): PortfolioPosition {
  const averagePrice = Math.max(0, safeFiniteNumber(row.average_price));
  const currentPrice = row.current_price === null ? averagePrice : Math.max(0, safeFiniteNumber(row.current_price, averagePrice));

  return {
    id: safeRecordId(row.id),
    symbol: safeSymbol(row.symbol),
    name: safeText(row.name, `${safeSymbol(row.symbol)} Position`, 100),
    assetType: safeAssetType(row.asset_type),
    sector: safeText(row.sector, "Nicht klassifiziert", 80),
    quantity: clampNumber(row.quantity, 0, 0, 1_000_000_000),
    averagePrice,
    currentPrice,
    currency: safeCurrency(row.currency),
    riskScore: Math.round(clampNumber(row.risk_score, 55, 0, 100))
  };
}

function normalizePortfolioTrade(trade: PortfolioTradeInput): PortfolioTradeInput {
  return {
    symbol: safeSymbol(trade.symbol),
    name: trade.name ? safeText(trade.name, safeSymbol(trade.symbol), 100) : undefined,
    assetType: safeAssetType(trade.assetType),
    sector: safeText(trade.sector, "Nicht klassifiziert", 80),
    side: trade.side === "sell" ? "sell" : "buy",
    quantity: clampNumber(trade.quantity, 0, 0, 1_000_000_000),
    price: Math.max(0, safeFiniteNumber(trade.price)),
    currency: safeCurrency(trade.currency),
    riskScore: Math.round(clampNumber(trade.riskScore, 55, 0, 100))
  };
}

function watchlistFromRow(row: WatchlistRow): WatchlistRow {
  return {
    id: safeRecordId(row.id),
    symbol: safeSymbol(row.symbol),
    asset_type: safeAssetType(row.asset_type),
    created_at: safeText(row.created_at, new Date(0).toISOString(), 40)
  };
}

export async function listUserAlerts(auth: Extract<AuthResult, { ok: true }>) {
  const { data, error } = await auth.supabase
    .from("alert_rules")
    .select("id,symbol,alert_type,condition,enabled")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw error;
  return ((data ?? []) as AlertRuleRow[]).map(alertFromRow);
}

export async function createUserAlert(
  auth: Extract<AuthResult, { ok: true }>,
  input: { symbol: string; type: AlertType; label: string; condition: string; enabled: boolean; threshold?: number; frequency?: AlertFrequency; notificationChannel?: AlertNotificationChannel }
) {
  const alertType = safeAlertType(input.type);
  const symbol = safeSymbol(input.symbol);

  const { data, error } = await auth.supabase
    .from("alert_rules")
    .insert({
      user_id: auth.userId,
      symbol,
      alert_type: alertType,
      condition: {
        text: safeText(input.condition, "Bedingung gespeichert", 140),
        label: safeText(input.label, alertLabels[alertType] ?? "Alarm", 90),
        threshold: Number.isFinite(Number(input.threshold)) ? Number(input.threshold) : undefined,
        frequency: safeAlertFrequency(input.frequency) ?? "manual",
        notificationChannel: safeNotificationChannel(input.notificationChannel) ?? "none"
      },
      enabled: input.enabled
    })
    .select("id,symbol,alert_type,condition,enabled")
    .single();

  if (error) throw error;
  return alertFromRow(data as AlertRuleRow);
}

export async function updateUserAlert(auth: Extract<AuthResult, { ok: true }>, id: string, enabled: boolean) {
  const { data, error } = await auth.supabase
    .from("alert_rules")
    .update({ enabled })
    .eq("id", safeRecordId(id))
    .eq("user_id", auth.userId)
    .select("id,symbol,alert_type,condition,enabled")
    .single();

  if (error) throw error;
  return alertFromRow(data as AlertRuleRow);
}

export async function deleteUserAlert(auth: Extract<AuthResult, { ok: true }>, id: string) {
  const { error } = await auth.supabase
    .from("alert_rules")
    .delete()
    .eq("id", safeRecordId(id))
    .eq("user_id", auth.userId);

  if (error) throw error;
}

export async function listUserPortfolioBooks(auth: Extract<AuthResult, { ok: true }>) {
  const { data, error } = await auth.supabase
    .from("portfolios")
    .select("id,name,base_currency,is_default,created_at,updated_at")
    .eq("user_id", auth.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) throw error;
  return ((data ?? []) as PortfolioBookRow[]).map(portfolioBookFromRow);
}

export async function createUserPortfolioBook(auth: Extract<AuthResult, { ok: true }>, name: string) {
  const existing = await listUserPortfolioBooks(auth);
  const { data, error } = await auth.supabase
    .from("portfolios")
    .insert({
      user_id: auth.userId,
      name: safeText(name, "Portfolio", 80),
      base_currency: "USD",
      is_default: existing.length === 0
    })
    .select("id,name,base_currency,is_default,created_at,updated_at")
    .single();

  if (error) throw error;
  return portfolioBookFromRow(data as PortfolioBookRow);
}

export async function deleteUserPortfolioBook(auth: Extract<AuthResult, { ok: true }>, id: string) {
  const { error } = await auth.supabase
    .from("portfolios")
    .delete()
    .eq("id", safeRecordId(id))
    .eq("user_id", auth.userId);

  if (error) throw error;
}

export async function getUserPortfolio(auth: Extract<AuthResult, { ok: true }>): Promise<PortfolioSummary> {
  const { data, error } = await auth.supabase
    .from("portfolio_positions")
    .select("id,symbol,name,asset_type,sector,quantity,average_price,current_price,currency,risk_score")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return analyzePortfolio(((data ?? []) as PortfolioPositionRow[]).map(positionFromRow));
}

export class PortfolioTradeConflictError extends Error {}

async function applyPortfolioTradeRpc(auth: Extract<AuthResult, { ok: true }>, trade: PortfolioTradeInput) {
  const normalizedTrade = normalizePortfolioTrade(trade);
  const { error } = await auth.supabase.rpc("apply_portfolio_trade", {
    p_user_id: auth.userId,
    p_symbol: normalizedTrade.symbol,
    p_name: normalizedTrade.name ?? null,
    p_asset_type: normalizedTrade.assetType,
    p_sector: normalizedTrade.sector,
    p_side: normalizedTrade.side,
    p_quantity: normalizedTrade.quantity,
    p_price: normalizedTrade.price,
    p_currency: normalizedTrade.currency,
    p_risk_score: normalizedTrade.riskScore
  });

  if (error) {
    if (/portfolio_sell_(?:position_missing|exceeds_position)/i.test(error.message ?? "")) {
      throw new PortfolioTradeConflictError(
        /position_missing/i.test(error.message ?? "")
          ? "Für dieses Symbol ist keine verkaufbare Position vorhanden."
          : "Die Verkaufsmenge übersteigt den vorhandenen Bestand."
      );
    }
    throw error;
  }
}

export async function applyUserPortfolioTrade(auth: Extract<AuthResult, { ok: true }>, trade: PortfolioTradeInput) {
  const normalizedTrade = normalizePortfolioTrade(trade);
  await applyPortfolioTradeRpc(auth, normalizedTrade);
  return getUserPortfolio(auth);
}

const personalDataTables = [
  { key: "profile", table: "profiles", ownerColumn: "id" },
  { key: "watchlists", table: "watchlists", ownerColumn: "user_id" },
  { key: "alerts", table: "alert_rules", ownerColumn: "user_id" },
  { key: "alertEvents", table: "alert_events", ownerColumn: "user_id" },
  { key: "portfolios", table: "portfolios", ownerColumn: "user_id" },
  { key: "portfolioPositions", table: "portfolio_positions", ownerColumn: "user_id" },
  { key: "portfolioTransactions", table: "portfolio_transactions", ownerColumn: "user_id" },
  { key: "portfolioSnapshots", table: "portfolio_snapshots", ownerColumn: "user_id" },
  { key: "analyses", table: "analysis_snapshots", ownerColumn: "user_id" },
  { key: "notifications", table: "notifications", ownerColumn: "user_id" },
  { key: "entitlements", table: "entitlements", ownerColumn: "user_id" },
  { key: "intelligenceAlerts", table: "intelligence_alerts", ownerColumn: "user_id" }
] as const;

export async function exportUserData(auth: Extract<AuthResult, { ok: true }>) {
  const entries = await Promise.all(
    personalDataTables.map(async ({ key, table, ownerColumn }) => {
      const { data, error } = await auth.supabase.from(table).select("*").eq(ownerColumn, auth.userId).limit(5_000);
      if (error) throw error;
      return [key, data ?? []] as const;
    })
  );

  return {
    format: "stockpilot-user-export-v1",
    exportedAt: new Date().toISOString(),
    user: { id: auth.userId, email: auth.email },
    rowLimitPerTable: 5_000,
    data: Object.fromEntries(entries)
  };
}

export async function deleteUserAccount(auth: Extract<AuthResult, { ok: true }>) {
  const { error: signOutError } = await auth.supabase.auth.admin.signOut(auth.accessToken, "global");
  const signOutStatus = (signOutError as { status?: number } | null)?.status;
  if (signOutError && signOutStatus !== 401 && signOutStatus !== 404) throw signOutError;

  const { error } = await auth.supabase.auth.admin.deleteUser(auth.userId);
  if (error) throw error;
}

export async function deleteUserPortfolioPosition(auth: Extract<AuthResult, { ok: true }>, id: string) {
  const { error } = await auth.supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", safeRecordId(id))
    .eq("user_id", auth.userId);

  if (error) throw error;
  return getUserPortfolio(auth);
}

export async function listUserWatchlist(auth: Extract<AuthResult, { ok: true }>) {
  const { data, error } = await auth.supabase
    .from("watchlists")
    .select("id,symbol,asset_type,created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data ?? []) as WatchlistRow[]).map(watchlistFromRow);
}

export async function addUserWatchlistItem(auth: Extract<AuthResult, { ok: true }>, symbol: string, assetType: AssetType) {
  const { data, error } = await auth.supabase
    .from("watchlists")
    .upsert({
      user_id: auth.userId,
      symbol: safeSymbol(symbol),
      asset_type: safeAssetType(assetType)
    }, {
      onConflict: "user_id,symbol"
    })
    .select("id,symbol,asset_type,created_at")
    .single();

  if (error) throw error;
  return watchlistFromRow(data as WatchlistRow);
}

export async function removeUserWatchlistItem(auth: Extract<AuthResult, { ok: true }>, symbol: string) {
  const { error } = await auth.supabase
    .from("watchlists")
    .delete()
    .eq("user_id", auth.userId)
    .eq("symbol", safeSymbol(symbol));

  if (error) throw error;
}
