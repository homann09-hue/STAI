import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { runForecastOutcomeWorker, writeModelEvaluation } from "@/lib/forecast-outcome-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORECAST_MODEL_KEY = "stockpilot.forecast";
const FORECAST_MODEL_VERSION = "1.0.0-deterministic";
const EVALUATION_WINDOW_DAYS = 90;

/**
 * Cron-Endpunkt für die Prognoseauswertung.
 *
 * Zwei Schritte:
 *   1. Fällige Prognosen gegen den tatsächlichen Kurs auswerten.
 *   2. Aus den ausgewerteten Ergebnissen eine Modellbilanz fortschreiben.
 *
 * Schlechte Ergebnisse werden geschrieben, nicht verworfen. Das ist der Punkt
 * der ganzen Übung: eine überprüfbare Trefferbilanz statt einer Behauptung.
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
 * Holt den realisierten Kurs. Liefert `null`, wenn kein belastbarer Kurs
 * vorliegt — dann bleibt das Ergebnis `insufficient_data` statt geschätzt zu
 * werden.
 */
async function resolveRealizedPrice(symbol: string): Promise<number | null> {
  try {
    const quote = await getMarketDataProvider().getQuote(symbol);
    if (!quote) return null;

    // Mock- und nicht verfügbare Kurse dürfen niemals in eine Trefferbilanz
    // einfliessen. Sonst bewertet sich das Modell gegen erfundene Daten.
    if (quote.quality === "mock" || quote.quality === "unavailable") return null;

    return Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
  } catch (error) {
    logEvent("warn", "forecast_evaluate.quote_failed", {
      symbol,
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = isAuthorized(request);
  if (!auth.ok) {
    return jsonError(
      auth.mode === "missing_secret"
        ? "Cron Secret fehlt. Prognoseauswertung ist deaktiviert."
        : "Cron nicht autorisiert.",
      auth.mode === "missing_secret" ? 503 : 401
    );
  }

  try {
    const now = new Date();
    const worker = await runForecastOutcomeWorker(resolveRealizedPrice, now);

    // Bilanz nur fortschreiben, wenn tatsächlich etwas ausgewertet wurde.
    const evaluation =
      worker.matured > 0
        ? await writeModelEvaluation(
            FORECAST_MODEL_KEY,
            FORECAST_MODEL_VERSION,
            new Date(now.getTime() - EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000),
            now
          )
        : { status: "skipped" as const, reason: "keine neu gereiften Prognosen" };

    logEvent("info", "forecast_evaluate.completed", {
      due: worker.due,
      matured: worker.matured,
      insufficientData: worker.insufficientData,
      failed: worker.failed
    });

    return jsonOk(
      {
        worker,
        evaluation,
        disclaimer:
          "Die Bilanz umfasst nur bewertbare Prognosen. Eine niedrige Bewertungsquote entwertet die Trefferquote und wird deshalb mit ausgewiesen."
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logEvent("error", "forecast_evaluate.failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonError("Prognoseauswertung fehlgeschlagen.", 500);
  }
}
