import { jsonOk } from "@/lib/api-guard";
import { getEnterpriseStatus } from "@/lib/enterprise-status";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(getEnterpriseStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
