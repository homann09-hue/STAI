import { mockAlerts } from "@/lib/mock/market";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { createUserAlert, deleteUserAlert, getSupabaseAuth, listUserAlerts, updateUserAlert } from "@/lib/supabase/user-data";
import { alertInputSchema, alertUpdateInputSchema } from "@/lib/validation";

const userDataHeaders = {
  "Cache-Control": "private, no-store"
};

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const alerts = await listUserAlerts(auth);
    return jsonOk({
      alerts,
      mode: "supabase",
      metadata: {
        storage: "supabase",
        dataQuality: "user_data",
        demo: false,
        execution: "backend_prepared",
        disclaimer: "Alerts sind nutzerbezogen. Ausführung hängt von Backend-/Cron-Konfiguration ab."
      }
    }, { headers: userDataHeaders });
  }

  return jsonOk({
    alerts: mockAlerts,
    mode: "local",
    reason: auth.reason,
    metadata: {
      storage: "client",
      dataQuality: "mock",
      demo: true,
      execution: "demo_only",
      disclaimer: "Demo-Alerts aus Mock-Daten. Sie wirken nicht als echte Server-Benachrichtigungen."
    }
  }, { headers: userDataHeaders });
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
    return jsonOk({ alert, mode: "supabase" }, { status: 201, headers: userDataHeaders });
  }

  return jsonError("Anmeldung erforderlich. Alarm-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
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
    return jsonOk({ alert, mode: "supabase" }, { headers: userDataHeaders });
  }

  return jsonError("Anmeldung erforderlich. Alarm-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
}

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, alertUpdateInputSchema.pick({ id: true }));
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    await deleteUserAlert(auth, parsed.data.id);
    return jsonOk({ ok: true, mode: "supabase" }, { headers: userDataHeaders });
  }

  return jsonError("Anmeldung erforderlich. Alarm-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
}
