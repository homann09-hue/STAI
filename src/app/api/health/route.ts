import { hasPrivilegedAccess, hasStrongAdminSecret } from "@/lib/admin-access";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getPublicRuntimeDiagnostics } from "@/lib/observability";
import { getProviderHealthReport } from "@/lib/provider-health";
import { getServerCacheAdapter } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  if (!hasPrivilegedAccess(request, "admin")) {
    return jsonOk(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        mode: "public",
        diagnostics: "protected",
        adminSecretConfigured: hasStrongAdminSecret()
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-StockPilot-Diagnostics": "protected"
        }
      }
    );
  }

  const cache = getServerCacheAdapter();

  return jsonOk(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      runtime: getPublicRuntimeDiagnostics(),
      cache: {
        mode: cache.mode,
        sharedConfigured: cache.sharedConfigured
      },
      providerHealth: getProviderHealthReport()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
