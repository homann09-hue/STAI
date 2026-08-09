import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { buildForecastLedgerResponse } from "@/lib/forecast-ledger";
import { persistForecastLedgerResponse } from "@/lib/forecast-ledger-store";
import { selectForecastCoverage, type CoverageCandidate } from "@/lib/forecast-coverage";
import { shouldGenerateForecasts } from "@/lib/forecast-schedule";
import { logEvent } from "@/lib/observability";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

/**
 * Erzeugt planmäßig Prognosen und schreibt sie in den Ledger.
 *
 * Ohne diesen Job entstehen Prognosen nur, wenn zufällig jemand eine
 * Detailseite aufruft. Eine Trefferbilanz braucht aber einen stetigen,
 * unvoreingenommenen Strom — sonst bewertet sich das Modell nur an den
 * Instrumenten, die gerade jemand angesehen hat. Genau das wäre ein
 * Selection Bias.
 */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.STOCKPILOT_CRON_SECRET;
  if (!secret) return { ok: false, mode: "missing_secret" as const };
  return {
    ok: request.headers.get("authorization") === `Bearer ${secret}`,
    mode: "secret" as const
  };
}

/**
 * Kandidaten aus dem Instrument Master, angereichert um den Zeitpunkt der
 * letzten Prognose.
 */
async function loadCoverageCandidates(): Promise<CoverageCandidate[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("instruments")
    .select("symbol,quote_status,confirmation_count")
    .eq("quote_status", "available")
    .order("confirmation_count", { ascending: false })
    .limit(200);

  if (error) {
    logEvent("warn", "forecast_generate.candidates_failed", { code: error.code, message: error.message });
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const symbols = rows.map((row) => String(row.symbol));

  const { data: recent } = await supabase
    .from("forecasts")
    .select("symbol,generated_at")
    .in("symbol", symbols)
    .order("generated_at", { ascending: false })
    .limit(1000);

  const lastForecastBySymbol = new Map<string, string>();
  for (const row of recent ?? []) {
    const symbol = String(row.symbol);
    if (!lastForecastBySymbol.has(symbol)) {
      lastForecastBySymbol.set(symbol, String(row.generated_at));
    }
  }

  return rows.map((row) => ({
    symbol: String(row.symbol),
    quoteStatus: "available" as const,
    confirmationCount: Number(row.confirmation_count ?? 0),
    lastForecastAt: lastForecastBySymbol.get(String(row.symbol)) ?? null
  }));
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = isAuthorized(request);
  if (!auth.ok) {
    return jsonError(
      auth.mode === "missing_secret"
        ? "Cron Secret fehlt. Prognoseerzeugung ist deaktiviert."
        : "Cron nicht autorisiert.",
      auth.mode === "missing_secret" ? 503 : 401
    );
  }

  // Wochentagsentscheidung bewusst hier statt im Cron-Ausdruck: Vercel laesst
  // auf dem Hobby-Tarif nur einen Lauf pro Tag zu und bricht das Deployment bei
  // haeufigeren Ausdruecken ab. Ein Filter wie "0 8 * * 1-5" waere dort riskant.
  const schedule = shouldGenerateForecasts(new Date());
  if (!schedule.shouldRun) {
    return jsonOk(
      { skippedRun: true, reason: schedule.reason, generated: 0, stored: 0, skipped: 0, failed: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const candidates = await loadCoverageCandidates();
    const selection = selectForecastCoverage(candidates, { batchSize: BATCH_SIZE });

    if (selection.symbols.length === 0) {
      return jsonOk({ selection, generated: 0, stored: 0, skipped: 0, failed: 0 }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const provider = getMarketDataProvider();
    let stored = 0;
    let skipped = 0;
    let failed = 0;

    for (const symbol of selection.symbols) {
      try {
        const detail = await provider.getAsset(symbol);

        // Ohne Asset oder mit Mock-/nicht verfügbaren Daten entsteht keine
        // Prognose. Ein Ledger-Eintrag auf erfundener Grundlage wäre wertlos
        // und würde die Bilanz verfälschen.
        if (!detail || detail.quote.quality === "mock" || detail.quote.quality === "unavailable") {
          skipped += 1;
          continue;
        }

        const response = buildForecastLedgerResponse(detail);
        const persistence = await persistForecastLedgerResponse(response);

        if (persistence.status === "stored") stored += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        logEvent("warn", "forecast_generate.symbol_failed", {
          symbol,
          message: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    logEvent("info", "forecast_generate.completed", {
      selected: selection.symbols.length,
      stored,
      skipped,
      failed,
      usedBootstrap: selection.usedBootstrap
    });

    return jsonOk(
      {
        selection,
        generated: selection.symbols.length,
        stored,
        skipped,
        failed,
        disclaimer:
          "Prognosen werden nur für Instrumente mit bestätigter Kursverfügbarkeit erzeugt. Ohne belegbaren Kurs entsteht keine bewertbare Prognose."
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logEvent("error", "forecast_generate.failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonError("Prognoseerzeugung fehlgeschlagen.", 500);
  }
}
