import { hasPrivilegedAccess, hasStrongAdminSecret } from "@/lib/admin-access";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getProviderHealthReport } from "@/lib/provider-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  if (!hasPrivilegedAccess(request, "admin")) {
    return jsonOk(
      {
        generatedAt: new Date().toISOString(),
        readinessScore: "protected",
        totals: {
          total: "protected",
          details: "protected"
        },
        mode: "public",
        details: "protected",
        adminSecretConfigured: hasStrongAdminSecret(),
        warning: "Provider-Details und Konfigurationsnamen sind geschützt."
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-StockPilot-Provider-Health": "protected"
        }
      }
    );
  }

  const report = getProviderHealthReport();

  return jsonOk(report, {
    headers: {
      "Cache-Control": "no-store",
      "X-StockPilot-Provider-Health": "detailed"
    }
  });
}
