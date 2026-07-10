import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { exportUserData, getSupabaseAuth } from "@/lib/supabase/user-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonError("Anmeldung für den Datenexport erforderlich.", 401, { "X-StockPilot-Auth-Reason": auth.reason });

  try {
    const exported = await exportUserData(auth);
    return jsonOk(exported, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="stockpilot-user-export-${new Date().toISOString().slice(0, 10)}.json"`,
        Vary: "Authorization"
      }
    });
  } catch {
    return jsonError("Datenexport konnte nicht vollständig erstellt werden.", 503);
  }
}
