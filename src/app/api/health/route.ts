import { jsonOk } from "@/lib/api-guard";
import { getPublicRuntimeDiagnostics } from "@/lib/observability";
import { getServerCacheAdapter } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const cache = getServerCacheAdapter();

  return jsonOk(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      runtime: getPublicRuntimeDiagnostics(),
      cache: {
        mode: cache.mode,
        sharedConfigured: cache.sharedConfigured
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
