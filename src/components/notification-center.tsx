"use client";

import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import type { AppNotification, AppNotificationSeverity } from "@/lib/notifications";

const severityTone: Record<AppNotificationSeverity, string> = {
  info: "border-cyan/25 bg-cyan/10 text-cyan",
  success: "border-profit/25 bg-profit/10 text-profit",
  warning: "border-amber/25 bg-amber/10 text-amber",
  critical: "border-loss/25 bg-loss/10 text-loss"
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(readOfflineValue<string[]>(OFFLINE_KEYS.notificationReadIds) ?? []);

    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { notifications?: AppNotification[] }) => {
        setNotifications(payload.notifications ?? []);
      })
      .catch(() => {
        setNotifications([
          {
            id: "notification-api-offline",
            title: "Notification Center offline",
            message: "Systemhinweise konnten nicht geladen werden. Lokale App-Funktionen bleiben nutzbar.",
            severity: "warning",
            category: "system",
            createdAt: new Date().toISOString(),
            source: "Client Fallback",
            status: "blocked"
          }
        ]);
      });
  }, []);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.notificationReadIds, readIds);
  }, [readIds]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.includes(item.id)).length,
    [notifications, readIds]
  );

  function markAllRead() {
    setReadIds(notifications.map((item) => item.id));
  }

  function markRead(id: string) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative hidden h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan lg:grid"
        aria-label={`Notification Center öffnen, ${unreadCount} ungelesen`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-loss px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[75] bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Notification Center">
          <section className="ml-auto h-full max-w-xl overflow-hidden rounded-[1.5rem] border border-stroke bg-[#07111f] shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-3 border-b border-stroke p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan">Notification Center</p>
                <h2 className="mt-1 text-xl font-semibold text-mist">Alerts, Provider, Portfolio und System</h2>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={markAllRead} className="grid h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted" aria-label="Alle gelesen markieren">
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted" aria-label="Schließen">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-5.5rem)] overflow-y-auto p-3">
              {notifications.length ? notifications.map((item) => {
                const read = readIds.includes(item.id);
                return (
                  <article key={item.id} className={`mb-3 rounded-2xl border p-4 ${severityTone[item.severity]} ${read ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-mist">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted">{item.message}</p>
                        <p className="mt-2 text-xs text-muted">
                          {item.source} · {new Date(item.createdAt).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <button type="button" onClick={() => markRead(item.id)} className="shrink-0 rounded-xl border border-stroke bg-coal px-2 py-1 text-xs text-muted">
                        {read ? "gelesen" : "ok"}
                      </button>
                    </div>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-stroke bg-coal px-3 text-xs font-semibold text-mist">
                        Öffnen
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </article>
                );
              }) : (
                <div className="rounded-2xl border border-stroke bg-panel p-6 text-center text-sm text-muted">
                  Keine aktuellen Hinweise.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
