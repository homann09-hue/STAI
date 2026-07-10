import { hasPrivilegedAccess } from "@/lib/admin-access";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { runProviderPings } from "@/lib/provider-ping";

export const dynamic = "force-dynamic";
const PROVIDER_PING_CACHE_TTL_MS = 60_000;
let cachedProviderPing: Awaited<ReturnType<typeof runProviderPings>> | null = null;
let cachedProviderPingUntil = 0;

function safeProviderPingStatus() {
  const checkedAt = new Date().toISOString();
  const checks = [
    { id: "market-data", name: "Marktdaten" },
    { id: "crypto-data", name: "Krypto-Daten" },
    { id: "news-data", name: "News-Daten" },
    { id: "fundamentals-data", name: "Fundamentaldaten" },
    { id: "ai-analysis", name: "KI-Analyse" },
    { id: "user-data", name: "Userdaten" },
    { id: "cache-limits", name: "Cache & Limits" },
    { id: "billing-gates", name: "Billing & Gates" }
  ].map((item) => ({
    ...item,
    status: "skipped",
    latencyMs: null,
    checkedAt,
    message: "Echter Provider-Ping ist geschützt. Autorisierte Admin-Anfrage erforderlich."
  }));

  return {
    generatedAt: checkedAt,
    readinessScore: "protected",
    mode: "protected",
    checks,
    summary: {
      ok: 0,
      degraded: checks.length,
      missingKey: 0,
      error: 0
    },
    warning:
      "Provider-Pings sind geschützt, damit öffentliche Requests keine API-Quotas verbrennen. Autorisierte Admin-Checks brauchen einen Bearer Secret Header."
  };
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  if (!hasPrivilegedAccess(request, "provider_ping")) {
    return jsonOk(safeProviderPingStatus(), {
      headers: {
        "Cache-Control": "private, no-store",
        "X-StockPilot-Provider-Ping": "protected"
      }
    });
  }

  try {
    if (cachedProviderPing && cachedProviderPingUntil > Date.now()) {
      return jsonOk({ ...cachedProviderPing, cache: { fromCache: true, ttlMs: PROVIDER_PING_CACHE_TTL_MS } }, {
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-StockPilot-Provider-Ping": "cached"
        }
      });
    }

    const result = await runProviderPings();
    cachedProviderPing = result;
    cachedProviderPingUntil = Date.now() + PROVIDER_PING_CACHE_TTL_MS;

    return jsonOk(result, {
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-StockPilot-Provider-Ping": "fresh"
      }
    });
  } catch (error) {
    logEvent("error", "providers.ping_failed", { error });
    return jsonError("Provider-Pings konnten nicht ausgeführt werden.", 500);
  }
}
