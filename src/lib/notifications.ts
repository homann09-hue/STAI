import { appFunctionAudits } from "@/lib/function-audit";
import { getProviderHealthReport } from "@/lib/provider-health";

export type AppNotificationSeverity = "info" | "success" | "warning" | "critical";
export type AppNotificationCategory = "alert" | "provider" | "portfolio" | "system" | "billing" | "data";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  severity: AppNotificationSeverity;
  category: AppNotificationCategory;
  createdAt: string;
  href?: string;
  source: string;
  status: "new" | "read" | "blocked" | "action_required";
};

export function buildSystemNotifications(now = new Date()): AppNotification[] {
  const createdAt = now.toISOString();
  const providerHealth = getProviderHealthReport(now);
  const baseNotifications: AppNotification[] = [
    {
      id: "system-no-advice",
      title: "Keine Anlageberatung",
      message: "Analysen bleiben algorithmische Einschätzungen. Prüfe Datenqualität, Risiko und Quellen, bevor du Entscheidungen triffst.",
      severity: "info",
      category: "system",
      createdAt,
      href: "/settings",
      source: "Compliance",
      status: "new"
    },
    {
      id: "alerts-worker",
      title: "Alert-Worker bereit zum Aktivieren",
      message: "Lokale Alerts sind nutzbar. Serverseitige Ausführung läuft erst mit Cron-Secret, Supabase-Session und Notification-Zielen.",
      severity: "warning",
      category: "alert",
      createdAt,
      href: "/alerts",
      source: "Alert Engine",
      status: "action_required"
    }
  ];
  const providerRisks = providerHealth.topRisks.slice(0, 3).map<AppNotification>((item) => ({
    id: `provider-${item.id}`,
    title: `${item.name}: ${item.status === "missing_key" ? "API-Key fehlt" : "Status prüfen"}`,
    message: `${item.userImpact} Nächster Schritt: ${item.nextAction}`,
    severity: item.status === "missing_key" ? "critical" : "warning",
    category: "provider",
    createdAt,
    href: "/settings",
    source: "Provider Health",
    status: "action_required"
  }));
  const unfinished = appFunctionAudits
    .filter((item) => item.status !== "live")
    .slice(0, 4)
    .map<AppNotification>((item) => ({
      id: `function-${item.id}`,
      title: `${item.area}: ${item.status === "prepared" ? "Backend/Provider fehlt" : "eingeschränkt"}`,
      message: item.improvement,
      severity: item.priority === "P0" ? "warning" : "info",
      category: item.id === "pricing" ? "billing" : "system",
      createdAt,
      href: item.route === "app-shell" ? "/settings" : item.route,
      source: "Function Audit",
      status: "action_required"
    }));

  return [
    ...baseNotifications,
    ...providerRisks,
    ...unfinished
  ].slice(0, 10);
}
