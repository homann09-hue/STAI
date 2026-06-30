import { mockAlerts } from "@/lib/mock/market";
import { jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { createUserAlert, getSupabaseAuth, listUserAlerts, updateUserAlert } from "@/lib/supabase/user-data";
import { alertInputSchema, alertUpdateInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const alerts = await listUserAlerts(auth);
    return jsonOk({ alerts, mode: "supabase" });
  }

  return jsonOk({ alerts: mockAlerts, mode: "local", reason: auth.reason });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, alertInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const alert = await createUserAlert(auth, parsed.data);
    return jsonOk({ alert, mode: "supabase" }, { status: 201 });
  }

  return jsonOk(
    {
      alert: {
        id: `api-${Date.now()}`,
        ...parsed.data
      },
      mode: "local",
      reason: auth.reason
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, alertUpdateInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const alert = await updateUserAlert(auth, parsed.data.id, parsed.data.enabled);
    return jsonOk({ alert, mode: "supabase" });
  }

  return jsonOk({ alert: parsed.data, mode: "local", reason: auth.reason });
}
