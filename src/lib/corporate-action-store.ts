import "server-only";

import type { CorporateAction } from "@/lib/corporate-actions";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface CorporateActionPersistResult {
  status: "stored" | "skipped" | "failed";
  stored: number;
  reason?: string;
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
