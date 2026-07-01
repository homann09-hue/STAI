import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { runProviderPings } from "@/lib/provider-ping";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  try {
    const result = await runProviderPings();
    return jsonOk(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logEvent("error", "providers.ping_failed", { error });
    return jsonError("Provider-Pings konnten nicht ausgeführt werden.", 500);
  }
}
