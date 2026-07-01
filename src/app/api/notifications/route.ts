import { jsonOk, rateLimit } from "@/lib/api-guard";
import { buildSystemNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  return jsonOk(
    {
      notifications: buildSystemNotifications(),
      mode: "system"
    },
    {
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
