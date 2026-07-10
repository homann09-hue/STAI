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
      title: "Alert-Worker läuft sicher im Dry-Run",
      message:
        "Lokale Alerts sind nutzbar. Serverseitige Ausführung schreibt erst Events, wenn echte Providerwerte angebunden sind oder Simulation bewusst für Tests aktiviert wird.",
      severity: "warning",
      category: "alert",
      createdAt,
      href: "/alerts",
      source: "Alert Engine",
      status: "action_required"
    },
    {
      id: "provider-diagnostics-protected",
      title: "Provider-Diagnostik geschützt",
      message: "Konkrete Anbieter-, Key- und Lizenzdetails sind admin-geschützt. Öffentliche Flächen zeigen nur Datenqualität und Fallback-Hinweise.",
      severity: "info",
      category: "provider",
      createdAt,
      href: "/settings",
      source: "Provider Health",
      status: "new"
    },
    {
      id: "data-quality-visible",
      title: "Datenqualität direkt prüfen",
      message: "Achte bei Kursen, News, Kennzahlen und Analysen auf Realtime, Near-Realtime, Delayed, Cached, Mock oder Unavailable.",
      severity: "warning",
      category: "data",
      createdAt,
      href: "/markets",
      source: "Data Quality",
      status: "action_required"
    }
  ];

  return baseNotifications;
}
