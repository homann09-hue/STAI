import { hasPrivilegedAccess, hasStrongAdminSecret } from "@/lib/admin-access";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getEnterpriseStatus } from "@/lib/enterprise-status";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  if (!hasPrivilegedAccess(request, "admin")) {
    return jsonOk(
      {
        status: "protected",
        mode: "public",
        generatedAt: new Date().toISOString(),
        adminSecretConfigured: hasStrongAdminSecret(),
        message: "Enterprise-Details sind geschützt. Nutze einen Admin-Secret-Header für vollständige Diagnostik."
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-StockPilot-Enterprise-Status": "protected"
        }
      }
    );
  }

  return jsonOk(getEnterpriseStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
