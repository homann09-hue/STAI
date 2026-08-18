import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { reconcileAccountDeletionJobs } from "@/lib/account-deletion";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.STOCKPILOT_CRON_SECRET;
  if (!secret) return { ok: false, missing: true };
  return { ok: request.headers.get("authorization") === `Bearer ${secret}`, missing: false };
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const authorization = isAuthorized(request);
  if (!authorization.ok) {
    return jsonError(
      authorization.missing ? "Cron Secret fehlt. Kontolöschungs-Worker ist deaktiviert." : "Cron nicht autorisiert.",
      authorization.missing ? 503 : 401
    );
  }

  try {
    const result = await reconcileAccountDeletionJobs();
    logEvent("info", "account_deletion.reconciliation_completed", result);
    return jsonOk(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Kontolöschungs-Worker konnte nicht sicher ausgeführt werden.", 503);
  }
}
