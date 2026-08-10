import "server-only";

import type { CorporateAction } from "@/lib/corporate-actions";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface CorporateActionPersistResult {
  status: "stored" | "skipped" | "failed";
  stored: number;
  reason?: string;
}

export interface CorporateActionCalendarResult {
  available: boolean;
  events: CorporateAction[];
  retrievedAt: string;
  complete: false;
  source: "corporate_actions_ledger" | null;
  note: string;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listCorporateActionsByDateRange(
  from: string,
  to: string,
  limit = 500
): Promise<CorporateActionCalendarResult> {
  const retrievedAt = new Date().toISOString();
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return {
      available: false,
      events: [],
      retrievedAt,
      complete: false,
      source: null,
      note: "Corporate-Action-Ledger ist serverseitig nicht konfiguriert."
    };
  }

  const { data, error } = await supabase
    .from("corporate_actions")
    .select("canonical_action_id,symbol,action_type,effective_date,announcement_date,record_date,payment_date,old_symbol,new_symbol,cash_amount,adjusted_cash_amount,currency,ratio_from,ratio_to,lifecycle_status,provider,source_reference,data_quality,as_of,received_at")
    .gte("effective_date", from)
    .lte("effective_date", to)
    .order("effective_date", { ascending: true })
    .order("symbol", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 1_000));

  if (error) {
    logEvent("warn", "corporate_actions.calendar_read_failed", {
      code: error.code,
      message: error.message
    });
    return {
      available: false,
      events: [],
      retrievedAt,
      complete: false,
      source: null,
      note: "Corporate-Action-Ledger konnte nicht gelesen werden."
    };
  }

  const events = (data ?? []).map((row) => ({
    canonicalActionId: String(row.canonical_action_id),
    symbol: String(row.symbol),
    type: row.action_type as CorporateAction["type"],
    effectiveDate: String(row.effective_date),
    announcementDate: row.announcement_date ? String(row.announcement_date) : null,
    recordDate: row.record_date ? String(row.record_date) : null,
    paymentDate: row.payment_date ? String(row.payment_date) : null,
    oldSymbol: row.old_symbol ? String(row.old_symbol) : null,
    newSymbol: row.new_symbol ? String(row.new_symbol) : null,
    cashAmount: numberOrNull(row.cash_amount),
    adjustedCashAmount: numberOrNull(row.adjusted_cash_amount),
    currency: row.currency ? String(row.currency) : null,
    ratioFrom: numberOrNull(row.ratio_from),
    ratioTo: numberOrNull(row.ratio_to),
    lifecycle: row.lifecycle_status as CorporateAction["lifecycle"],
    provider: String(row.provider),
    sourceUrl: String(row.source_reference),
    quality: row.data_quality as CorporateAction["quality"],
    asOf: String(row.as_of),
    receivedAt: String(row.received_at)
  }));

  return {
    available: true,
    events,
    retrievedAt,
    complete: false,
    source: "corporate_actions_ledger",
    note: events.length
      ? `${events.length} belegte Ledger-Ereignisse im Zeitraum. Das Universum ist suchgetrieben und nicht vollständig.`
      : "Keine Ledger-Ereignisse im Zeitraum. Das ist kein Beleg dafür, dass weltweit keine Ereignisse stattfinden."
  };
}

/**
 * Persistiert provider-gemeldete Referenzdaten idempotent.
 *
 * Corporate Actions gehören keinem Nutzer. Der Service-Client ist hier wie
 * beim Instrument Master bewusst erlaubt; Browserclients besitzen keinerlei
 * Schreibrecht auf dem Ledger.
 */
export async function persistCorporateActions(
  actions: readonly CorporateAction[]
): Promise<CorporateActionPersistResult> {
  if (actions.length === 0) return { status: "skipped", stored: 0, reason: "keine Ereignisse" };

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { status: "skipped", stored: 0, reason: "Supabase Service-Client nicht konfiguriert" };
  }

  const symbols = [...new Set(actions.map((action) => action.symbol))];
  const { data: instruments, error: instrumentError } = await supabase
    .from("instruments")
    .select("id,symbol,confirmation_count")
    .in("symbol", symbols)
    .order("confirmation_count", { ascending: false });

  if (instrumentError) {
    logEvent("warn", "corporate_actions.instrument_lookup_failed", {
      code: instrumentError.code,
      message: instrumentError.message
    });
  }

  const instrumentBySymbol = new Map<string, string>();
  for (const instrument of instruments ?? []) {
    const symbol = String(instrument.symbol);
    if (!instrumentBySymbol.has(symbol)) instrumentBySymbol.set(symbol, String(instrument.id));
  }

  const rows = actions.map((action) => ({
    canonical_action_id: action.canonicalActionId,
    instrument_id: instrumentBySymbol.get(action.symbol) ?? null,
    symbol: action.symbol,
    action_type: action.type,
    effective_date: action.effectiveDate,
    announcement_date: action.announcementDate,
    record_date: action.recordDate,
    payment_date: action.paymentDate,
    old_symbol: action.oldSymbol,
    new_symbol: action.newSymbol,
    cash_amount: action.cashAmount,
    adjusted_cash_amount: action.adjustedCashAmount,
    currency: action.currency,
    ratio_from: action.ratioFrom,
    ratio_to: action.ratioTo,
    lifecycle_status: action.lifecycle,
    provider: action.provider,
    provider_event_id: null,
    source_reference: action.sourceUrl,
    data_quality: action.quality,
    as_of: action.asOf,
    received_at: action.receivedAt,
    last_confirmed_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from("corporate_actions")
    .upsert(rows, { onConflict: "canonical_action_id" });

  if (error) {
    logEvent("warn", "corporate_actions.persist_failed", {
      code: error.code,
      message: error.message,
      symbols
    });
    return { status: "failed", stored: 0, reason: "Ledger konnte nicht aktualisiert werden" };
  }

  return { status: "stored", stored: actions.length };
}
