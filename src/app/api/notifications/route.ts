import { jsonOk, rateLimit } from "@/lib/api-guard";
import type { AppNotification } from "@/lib/notifications";
import { buildSystemNotifications } from "@/lib/notifications";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const dynamic = "force-dynamic";

const notificationHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Authorization, Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Data-Quality": "system"
};

function normalizeNotificationRow(value: unknown): AppNotification | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title : "Benachrichtigung";
  const message = typeof row.message === "string" ? row.message : "Keine Nachricht verfügbar.";
  const severity = ["info", "success", "warning", "critical"].includes(row.severity as string)
    ? (row.severity as AppNotification["severity"])
    : "info";
  const category = ["alert", "provider", "portfolio", "system", "billing", "data"].includes(row.category as string)
    ? (row.category as AppNotification["category"])
    : "system";
  const status = ["new", "read", "blocked", "action_required"].includes(row.status as string)
    ? (row.status as AppNotification["status"])
    : "new";
  const href = typeof row.href === "string" ? row.href : undefined;
  const source = typeof row.source === "string" ? row.source : "StockPilot AI";
  const createdAt = typeof row.created_at === "string" ? new Date(row.created_at).toISOString() : new Date().toISOString();

  if (!id) return null;

  return {
    id,
    title,
    message,
    severity,
    category,
    createdAt,
    href,
    source,
    status
  };
}

function buildFallbackNotification(createdAt: string): AppNotification {
  return {
    id: "notification-service-degraded",
    title: "Notification Center eingeschränkt",
    message: "Systemhinweise konnten nur im Sicherheitsmodus geladen werden. Marktdaten, Alerts und Portfolio bleiben getrennt gekennzeichnet.",
    severity: "warning",
    category: "system",
    createdAt,
    href: "/settings",
    source: "Notification API",
    status: "blocked"
  };
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const now = new Date();
  const generatedAt = now.toISOString();
  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const { data, error } = await auth.supabase
      .from("notifications")
      .select("id,category,severity,title,message,href,source,status,created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (!error && Array.isArray(data)) {
      const notifications = data
        .map(normalizeNotificationRow)
        .filter((item): item is AppNotification => item !== null);
      const systemNotifications = buildSystemNotifications(now);
      const mergedNotifications = [...notifications, ...systemNotifications].slice(0, 25);

      return jsonOk(
        {
          notifications: mergedNotifications,
          mode: "user",
          metadata: {
            dataQuality: "user_data",
            marketData: false,
            generatedAt,
            disclaimer: "Nutzerbenachrichtigungen und Systemhinweise werden gemischt dargestellt."
          }
        },
        {
          headers: notificationHeaders
        }
      );
    }
  }

  try {
    const notifications = buildSystemNotifications(now).slice(0, 25);

    return jsonOk(
      {
        notifications,
        mode: "system",
        metadata: {
          dataQuality: "system",
          marketData: false,
          generatedAt,
          disclaimer: "Systemhinweise sind keine Marktdaten und keine Anlageberatung."
        }
      },
      {
        headers: notificationHeaders
      }
    );
  } catch {
    return jsonOk(
      {
        notifications: [buildFallbackNotification(generatedAt)],
        mode: "system_degraded",
        metadata: {
          dataQuality: "system",
          marketData: false,
          generatedAt,
          disclaimer: "Systemhinweise sind keine Marktdaten und keine Anlageberatung.",
          degraded: true
        }
      },
      {
        headers: notificationHeaders
      }
    );
  }
}
