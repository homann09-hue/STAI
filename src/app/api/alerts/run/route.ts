import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: string;
  condition: {
    text?: string;
    label?: string;
    threshold?: number;
    frequency?: string;
    notificationChannel?: string;
  } | null;
  enabled: boolean;
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.STOCKPILOT_CRON_SECRET;
  if (!secret) return { ok: true, mode: "unprotected-local" };
  return {
    ok: request.headers.get("authorization") === `Bearer ${secret}`,
    mode: "secret"
  };
}

function simulatedValue(alert: AlertRow) {
  if (alert.alert_type === "price") return 150;
  if (alert.alert_type === "rsi") return 72;
  if (alert.alert_type === "volume") return 2.4;
  if (alert.alert_type === "portfolio-risk") return 68;
  if (alert.alert_type === "ai-risk") return 74;
  return null;
}

function shouldTrigger(alert: AlertRow) {
  const threshold = Number(alert.condition?.threshold);
  if (!Number.isFinite(threshold)) return false;
  const value = simulatedValue(alert);
  if (value === null) return false;
  const condition = alert.condition?.text?.toLowerCase() ?? "";
  if (condition.includes("unter") || condition.includes("<")) return value <= threshold;
  return value >= threshold;
}

async function runAlertWorker() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return {
      mode: "not_configured",
      checked: 0,
      triggered: 0,
      message: "Supabase Service Key fehlt. Lokale Alerts bleiben im Client nutzbar."
    };
  }

  const { data, error } = await supabase
    .from("alert_rules")
    .select("id,user_id,symbol,alert_type,condition,enabled")
    .eq("enabled", true)
    .limit(100);

  if (error) throw error;

  const alerts = ((data ?? []) as AlertRow[]);
  const triggered = alerts.filter(shouldTrigger);

  if (triggered.length) {
    const { error: insertError } = await supabase.from("alert_events").insert(
      triggered.map((alert) => ({
        user_id: alert.user_id,
        alert_rule_id: alert.id,
        symbol: alert.symbol,
        event_type: alert.alert_type,
        payload: {
          condition: alert.condition,
          simulated: true,
          note: "STAI Worker-Architektur: echte Providerwerte können hier serverseitig eingehängt werden."
        }
      }))
    );

    if (insertError) throw insertError;
  }

  logEvent("info", "alerts.worker_run", {
    checked: alerts.length,
    triggered: triggered.length
  });

  return {
    mode: "supabase",
    checked: alerts.length,
    triggered: triggered.length,
    message: "Alert-Worker ausgeführt. Providerwerte sind als nächster Schritt serverseitig anzubinden."
  };
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = isAuthorized(request);
  if (!auth.ok) return jsonError("Cron nicht autorisiert.", 401);

  try {
    const result = await runAlertWorker();
    return jsonOk(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logEvent("error", "alerts.worker_failed", { error });
    return jsonError("Alert-Worker konnte nicht ausgeführt werden.", 500);
  }
}
