import { jsonOk } from "@/lib/api-guard";
import { getProviderHealthReport } from "@/lib/provider-health";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(getProviderHealthReport(), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
