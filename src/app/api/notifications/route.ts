import { jsonOk, rateLimit } from "@/lib/api-guard";
import type { AppNotification } from "@/lib/notifications";
import { buildSystemNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const notificationHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Authorization, Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Data-Quality": "system"
};

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
