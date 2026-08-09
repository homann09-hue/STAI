import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { entitledCacheHeaders, requireFeature } from "@/lib/billing/feature-guard";
import { runBacktest } from "@/lib/analysis/backtest";
import { fetchDailyHistory } from "@/lib/providers/price-history";
import { validateSymbol } from "@/lib/validation";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Backtest auf echter Kurshistorie.
 *
 * **Serverseitig gegatet.** Die Rechnung selbst wäre im Browser möglich — die
 * Historie ist es nicht: §4 verlangt, dass der Client nie über den Tarif
 * entscheidet, und `historicalDataYears` ist genau hier ein echtes
 * Tarifmerkmal. Ein Free-Konto bekommt ein Jahr, und ein Backtest über ein Jahr
 * wird von `runBacktest` abgelehnt, statt eine Jahresrendite daraus
 * hochzurechnen.
 *
 * Das ist kein künstlicher Riegel, sondern derselbe Grundsatz wie überall:
 * lieber keine Zahl als eine, die nach einer Messung aussieht.
 */

const MAX_CAPITAL = 100_000_000;
const MAX_MONTHLY = 1_000_000;

function parseAmount(raw: string | null, fallback: number, max: number) {
  if (raw === null) return fallback;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, max);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const access = await requireFeature(request, "backtesting");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const parsedSymbol = validateSymbol(url.searchParams.get("symbol") ?? "");

  if (!parsedSymbol.success) {
    return jsonError("Kein gültiges Symbol angegeben.", 400);
  }

  const symbol = parsedSymbol.data;
  const initialCapital = parseAmount(url.searchParams.get("capital"), 10_000, MAX_CAPITAL);
  const monthlyContribution = parseAmount(url.searchParams.get("monthly"), 0, MAX_MONTHLY);

  // Die Kuerzung passiert im Abrufpfad, nicht in der Anzeige -- sonst laege die
  // volle Reihe im ausgelieferten JSON und ein Free-Konto kaeme mit dem
  // Entwicklerwerkzeug an die Premium-Historie.
  const limitYears = access.entitlements.limits.historicalDataYears;
  const history = await fetchDailyHistory(symbol, new Date(), limitYears);

  if (history.candles.length === 0) {
    return jsonError(
      `Für ${symbol} liegt keine Kurshistorie vor. ${history.note} Es wird bewusst keine Ersatzreihe erzeugt.`,
      503
    );
  }

  const result = runBacktest({ candles: history.candles, initialCapital, monthlyContribution });

  logEvent("info", "backtest.run", {
    userId: access.auth.userId,
    plan: access.entitlements.plan,
    symbol,
    candles: history.candles.length,
    limitYears,
    refused: !result.ok
  });

  return jsonOk(
    {
      symbol,
      result,
      metadata: {
        provider: history.provider,
        // Der Hinweis nennt auch die Kuerzung durch den Tarif. Ein Free-Konto
        // soll sehen, *warum* der Zeitraum kurz ist -- nicht nur, dass er es
        // ist.
        historyNote: history.note,
        planYears: limitYears,
        plan: access.entitlements.plan,
        disclaimer:
          "Ein Backtest zeigt, was gewesen wäre. Er ist keine Vorhersage und keine Anlageberatung."
      }
    },
    { headers: entitledCacheHeaders }
  );
}
