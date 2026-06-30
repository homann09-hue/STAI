import "server-only";

import { analyzePortfolio, applyPortfolioTrade } from "@/lib/portfolio-analytics";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AlertRule, AlertType, AssetType, PortfolioPosition, PortfolioSummary, PortfolioTradeInput } from "@/lib/types";

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type AuthResult =
  | { ok: true; supabase: SupabaseClient; userId: string; email: string | null }
  | { ok: false; reason: "missing_client" | "anonymous" | "invalid_token" };

type AlertRuleRow = {
  id: string;
  symbol: string;
  alert_type: AlertType;
  condition: { text?: string; label?: string } | null;
  enabled: boolean;
};

type PortfolioPositionRow = {
  id: string;
  symbol: string;
  name: string | null;
  asset_type: AssetType;
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
  asset_type: AssetType;
  created_at: string;
};

const alertLabels: Record<AlertType, string> = {
  price: "Kursalarm",
  rsi: "RSI uber/unter Wert",
  news: "Newsalarm",
  volume: "Volumenanstieg",
  earnings: "Earnings Reminder",
  "ai-risk": "KI-Risikoalarm",
  "ai-shift": "KI-Einschätzung veraendert",
  "portfolio-risk": "Portfolio-Risikoalarm"
};

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

  await supabase.from("profiles").upsert({
    id: data.user.id,
    email: data.user.email,
    display_name: data.user.user_metadata?.name ?? data.user.email?.split("@")[0] ?? null
  });

  return {
    ok: true,
    supabase,
    userId: data.user.id,
    email: data.user.email ?? null
  };
}

function alertFromRow(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    symbol: row.symbol,
    type: row.alert_type,
    label: row.condition?.label ?? alertLabels[row.alert_type] ?? "Alarm",
    condition: row.condition?.text ?? "Bedingung gespeichert",
    enabled: row.enabled
  };
}

function positionFromRow(row: PortfolioPositionRow): PortfolioPosition {
  const averagePrice = Number(row.average_price);
  const currentPrice = row.current_price === null ? averagePrice : Number(row.current_price);

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? `${row.symbol} Position`,
    assetType: row.asset_type,
    sector: row.sector,
    quantity: Number(row.quantity),
    averagePrice,
    currentPrice,
    currency: row.currency,
    riskScore: row.risk_score ?? 55
  };
}

export async function listUserAlerts(auth: Extract<AuthResult, { ok: true }>) {
  const { data, error } = await auth.supabase
    .from("alert_rules")
    .select("id,symbol,alert_type,condition,enabled")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as AlertRuleRow[]).map(alertFromRow);
}

export async function createUserAlert(
  auth: Extract<AuthResult, { ok: true }>,
  input: { symbol: string; type: AlertType; label: string; condition: string; enabled: boolean }
) {
  const { data, error } = await auth.supabase
    .from("alert_rules")
    .insert({
      user_id: auth.userId,
      symbol: input.symbol,
      alert_type: input.type,
      condition: {
        text: input.condition,
        label: input.label
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
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id,symbol,alert_type,condition,enabled")
    .single();

  if (error) throw error;
  return alertFromRow(data as AlertRuleRow);
}

export async function getUserPortfolio(auth: Extract<AuthResult, { ok: true }>): Promise<PortfolioSummary> {
  const { data, error } = await auth.supabase
    .from("portfolio_positions")
    .select("id,symbol,name,asset_type,sector,quantity,average_price,current_price,currency,risk_score")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return analyzePortfolio(((data ?? []) as PortfolioPositionRow[]).map(positionFromRow));
}

async function savePortfolioPositions(
  auth: Extract<AuthResult, { ok: true }>,
  positions: PortfolioPosition[],
  previousPositions: PortfolioPosition[] = []
) {
  const nextIds = new Set(positions.filter((position) => !position.id.startsWith("local-")).map((position) => position.id));
  const removedIds = previousPositions
    .filter((position) => !position.id.startsWith("local-") && !nextIds.has(position.id))
    .map((position) => position.id);

  if (removedIds.length) {
    const { error } = await auth.supabase
      .from("portfolio_positions")
      .delete()
      .eq("user_id", auth.userId)
      .in("id", removedIds);

    if (error) throw error;
  }

  const rows = positions.map((position) => ({
    user_id: auth.userId,
    symbol: position.symbol,
    name: position.name,
    asset_type: position.assetType,
    sector: position.sector,
    quantity: position.quantity,
    average_price: position.averagePrice,
    current_price: position.currentPrice,
    currency: position.currency,
    risk_score: position.riskScore
  }));

  if (!rows.length) return;

  const existingRows = rows
    .map((row, index) => ({ ...row, id: positions[index].id }))
    .filter((row) => !row.id.startsWith("local-"));
  const newRows = rows.filter((_row, index) => positions[index].id.startsWith("local-"));

  if (existingRows.length) {
    const { error } = await auth.supabase.from("portfolio_positions").upsert(existingRows, {
      onConflict: "id"
    });

    if (error) throw error;
  }

  if (!newRows.length) return;

  const { error } = await auth.supabase.from("portfolio_positions").insert(newRows);

  if (error) throw error;
}

export async function applyUserPortfolioTrade(auth: Extract<AuthResult, { ok: true }>, trade: PortfolioTradeInput) {
  const current = await getUserPortfolio(auth);
  const nextPositions = applyPortfolioTrade(current.positions, trade);

  await auth.supabase.from("portfolio_transactions").insert({
    user_id: auth.userId,
    symbol: trade.symbol,
    asset_type: trade.assetType,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    currency: trade.currency,
    notes: trade.name ?? null
  });

  await savePortfolioPositions(auth, nextPositions, current.positions);
  return analyzePortfolio(nextPositions);
}

export async function deleteUserPortfolioPosition(auth: Extract<AuthResult, { ok: true }>, id: string) {
  const { error } = await auth.supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) throw error;
  return getUserPortfolio(auth);
}

export async function listUserWatchlist(auth: Extract<AuthResult, { ok: true }>) {
  const { data, error } = await auth.supabase
    .from("watchlists")
    .select("id,symbol,asset_type,created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as WatchlistRow[];
}

export async function addUserWatchlistItem(auth: Extract<AuthResult, { ok: true }>, symbol: string, assetType: AssetType) {
  const { data, error } = await auth.supabase
    .from("watchlists")
    .upsert({
      user_id: auth.userId,
      symbol,
      asset_type: assetType
    }, {
      onConflict: "user_id,symbol"
    })
    .select("id,symbol,asset_type,created_at")
    .single();

  if (error) throw error;
  return data as WatchlistRow;
}

export async function removeUserWatchlistItem(auth: Extract<AuthResult, { ok: true }>, symbol: string) {
  const { error } = await auth.supabase
    .from("watchlists")
    .delete()
    .eq("user_id", auth.userId)
    .eq("symbol", symbol);

  if (error) throw error;
}
