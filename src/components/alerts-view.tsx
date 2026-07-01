"use client";

import { Bell, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import { alertInputSchema, normalizeSymbolInput } from "@/lib/validation";
import type { AlertRule, AlertType } from "@/lib/types";

const alertTypes: { value: AlertType; label: string }[] = [
  { value: "price", label: "Kursalarm" },
  { value: "rsi", label: "RSI über/unter Wert" },
  { value: "news", label: "Newsalarm" },
  { value: "volume", label: "Volumenanstieg" },
  { value: "earnings", label: "Earnings Reminder" },
  { value: "ai-risk", label: "KI-Risikoalarm" },
  { value: "ai-shift", label: "KI-Einschätzung verändert" },
  { value: "portfolio-risk", label: "Portfolio-Risikoalarm" }
];

export function AlertsView({ initialAlerts }: { initialAlerts: AlertRule[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [symbol, setSymbol] = useState("NVDA");
  const [type, setType] = useState<AlertType>("price");
  const [condition, setCondition] = useState("über 155 USD");
  const [threshold, setThreshold] = useState("155");
  const [frequency, setFrequency] = useState<"manual" | "10s" | "30s" | "60s" | "5min">("manual");
  const [notificationChannel, setNotificationChannel] = useState<"none" | "in_app" | "email" | "push" | "webhook">("none");
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [evaluationLog, setEvaluationLog] = useState<Record<string, string>>({});
  const [syncMode, setSyncMode] = useState<"demo" | "supabase">("demo");
  const [syncStatus, setSyncStatus] = useState("Lokaler Demo-Modus aktiv. Alerts werden nicht serverseitig ausgeführt.");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.alerts, alerts);
  }, [alerts]);

  useEffect(() => {
    let cancelled = false;
    const stored = readOfflineValue<AlertRule[]>(OFFLINE_KEYS.alerts);

    if (stored?.length) {
      setAlerts(stored);
      setSyncStatus("Lokale Offline-Alerts geladen. Serverseitige Ausführung nicht aktiv.");
    }

    fetchWithSupabaseAuth("/api/alerts")
      .then((response) => response.json())
      .then((data: { alerts?: AlertRule[]; mode?: string }) => {
        if (cancelled || !data.alerts?.length) return;
        setAlerts(data.alerts);
        setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
        setSyncStatus(data.mode === "supabase" ? "Supabase-Sync aktiv. Ausführung hängt vom Alert-Worker ab." : "Lokaler Demo-Modus aktiv.");
      })
      .catch(() => {
        if (!cancelled) {
          setSyncMode("demo");
          setSyncStatus("Supabase nicht erreichbar. Lokaler Demo-Modus aktiv.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function demoValueFor(alert: AlertRule) {
    if (alert.type === "price") return 150;
    if (alert.type === "rsi") return 72;
    if (alert.type === "volume") return 2.4;
    if (alert.type === "portfolio-risk") return 68;
    if (alert.type === "ai-risk") return 74;
    return null;
  }

  function shouldTrigger(alert: AlertRule) {
    if (!alert.enabled) return false;
    const value = demoValueFor(alert);
    if (value === null || alert.threshold === undefined) return false;
    const lowerCondition = alert.condition.toLowerCase();
    if (lowerCondition.includes("unter") || lowerCondition.includes("<")) return value <= alert.threshold;
    return value >= alert.threshold;
  }

  function runLocalCheck() {
    const checkedAt = new Date().toISOString();
    const nextLog: Record<string, string> = {};

    setAlerts((current) =>
      current.map((alert) => {
        if (!alert.enabled) {
          nextLog[alert.id] = "Pausiert. Keine Prüfung durchgeführt.";
          return { ...alert, status: "paused" };
        }

        const demoValue = demoValueFor(alert);
        if (demoValue === null) {
          nextLog[alert.id] = "Regel gespeichert. Echte Auslösung braucht News-, Earnings- oder KI-Worker.";
          return { ...alert, status: "unavailable" };
        }

        const triggered = shouldTrigger(alert);
        nextLog[alert.id] = `Lokale Prüfung: Modellwert ${demoValue}, Schwelle ${alert.threshold ?? "n/a"} -> ${triggered ? "ausgelöst" : "nicht ausgelöst"}.`;
        return { ...alert, status: triggered ? "triggered" : "created" };
      })
    );
    setEvaluationLog(nextLog);
    setLastCheck(checkedAt);
    setSyncStatus("Lokale Alert-Prüfung ausgeführt. Push/E-Mail/Webhook brauchen weiterhin Backend-Worker.");
  }

  async function addAlert() {
    const normalized = normalizeSymbolInput(symbol);
    const selected = alertTypes.find((item) => item.value === type);
    setFormError("");

    if (!normalized.ok) {
      setFormError(normalized.message);
      return;
    }

    const fallbackAlert = {
      id: `local-${Date.now()}`,
      symbol: normalized.symbol,
      type,
      label: selected?.label ?? "Alarm",
      condition,
      enabled: true,
      status: "demo" as const,
      threshold: Number(threshold.replace(",", ".")) || undefined,
      frequency,
      notificationChannel
    };
    const parsedAlert = alertInputSchema.safeParse(fallbackAlert);

    if (!parsedAlert.success) {
      setFormError("Bitte eine gültige Alert-Regel eingeben. Sonderzeichen wie < oder > sind nicht erlaubt.");
      return;
    }

    try {
      const response = await fetchWithSupabaseAuth("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsedAlert.data)
      });
      if (!response.ok) throw new Error("alert mutation not authenticated");
      const data = await response.json() as { alert?: AlertRule; mode?: string };
      setAlerts((current) => [data.alert ?? fallbackAlert, ...current]);
      setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
      setSyncStatus(data.mode === "supabase" ? "Alert in Supabase gespeichert." : "Alert lokal gespeichert. Keine serverseitige Ausführung.");
    } catch {
      setAlerts((current) => [fallbackAlert, ...current]);
      setSyncMode("demo");
      setSyncStatus("Nicht eingeloggt oder Supabase nicht erreichbar. Alert lokal gespeichert und nicht serverseitig aktiv.");
    }
  }

  async function toggleAlert(alert: AlertRule) {
    const nextEnabled = !alert.enabled;
    setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, enabled: nextEnabled } : item)));

    try {
      const response = await fetchWithSupabaseAuth("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: alert.id, enabled: nextEnabled })
      });
      if (!response.ok) throw new Error("alert update not authenticated");
      const data = await response.json() as { mode?: string };
      setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
      setSyncStatus(data.mode === "supabase" ? "Alert-Status synchronisiert." : "Alert-Status lokal geändert.");
    } catch {
      setSyncMode("demo");
      setSyncStatus("Supabase nicht erreichbar. Änderung bleibt lokal und wird nicht serverseitig ausgeführt.");
    }
  }

  function deleteAlert(id: string) {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    setSyncMode("demo");
    setSyncStatus("Alert lokal gelöscht. Cloud-Löschung braucht Supabase-Session.");
  }

  return (
    <div className="space-y-7">
      <section className="rounded-md border border-stroke bg-[linear-gradient(140deg,#101712,#07100d_70%,#172114)] p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Alerts</p>
            <h1 className="mt-2 text-3xl font-semibold">Signal- und Risikoalarme</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Kurs, RSI, News, Volumen, Earnings und KI-Risiko sind als Regeln modelliert.
              Ohne echten Alert-Worker werden lokale Regeln deutlich als Demo markiert.
            </p>
            <p className={`mt-3 rounded-xl border px-3 py-2 text-xs ${syncMode === "supabase" ? "border-profit/30 bg-profit/10 text-profit" : "border-amber/30 bg-amber/10 text-amber"}`}>{syncStatus}</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-md border border-amber/30 bg-amber/10 text-amber">
            <Bell className="h-5 w-5" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Neuer Alert</h2>
          <div className="rounded-md border border-stroke bg-panel p-4">
            <label className="block text-sm text-muted" htmlFor="alert-symbol">
              Symbol
            </label>
            <input
              id="alert-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />

            <label className="mt-4 block text-sm text-muted" htmlFor="alert-type">
              Typ
            </label>
            <select
              id="alert-type"
              value={type}
              onChange={(event) => setType(event.target.value as AlertType)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            >
              {alertTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm text-muted" htmlFor="alert-condition">
              Bedingung
            </label>
            <input
              id="alert-condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />

            <label className="mt-4 block text-sm text-muted" htmlFor="alert-threshold">
              Schwelle
            </label>
            <input
              id="alert-threshold"
              value={threshold}
              inputMode="decimal"
              onChange={(event) => setThreshold(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted" htmlFor="alert-frequency">
                Frequenz
                <select
                  id="alert-frequency"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as typeof frequency)}
                  className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
                >
                  <option value="manual">manuell</option>
                  <option value="10s">10s</option>
                  <option value="30s">30s</option>
                  <option value="60s">60s</option>
                  <option value="5min">5min</option>
                </select>
              </label>
              <label className="block text-sm text-muted" htmlFor="alert-channel">
                Kanal
                <select
                  id="alert-channel"
                  value={notificationChannel}
                  onChange={(event) => setNotificationChannel(event.target.value as typeof notificationChannel)}
                  className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
                >
                  <option value="none">kein externer Kanal</option>
                  <option value="in_app">In-App</option>
                  <option value="email">E-Mail vorbereitet</option>
                  <option value="push">Push vorbereitet</option>
                  <option value="webhook">Webhook vorbereitet</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={addAlert}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-profit font-semibold text-ink transition hover:bg-profit/90"
            >
              <Plus className="h-4 w-4" />
              Alert erstellen
            </button>
            {formError ? <p className="mt-3 rounded-md border border-loss/30 bg-loss/10 p-3 text-xs leading-5 text-loss">{formError}</p> : null}
            <p className="mt-3 rounded-md border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
              Demo-Hinweis: Lokale Alerts lösen keine echte Push-, E-Mail- oder Webhook-Benachrichtigung aus.
            </p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Aktive Regeln</h2>
              <p className="text-xs text-muted">{lastCheck ? `Letzte lokale Prüfung: ${new Date(lastCheck).toLocaleString("de-DE")}` : "Noch keine lokale Prüfung ausgeführt."}</p>
            </div>
            <button type="button" onClick={runLocalCheck} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 font-semibold text-cyan">
              <Play className="h-4 w-4" />
              Lokal prüfen
            </button>
          </div>
          <div className="space-y-3" data-testid="alert-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-stroke bg-panel p-4" data-testid="alert-rule">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{alert.symbol}</p>
                    <p className="mt-1 text-sm text-muted">{alert.label}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-[11px] ${syncMode === "supabase" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-amber/30 bg-amber/10 text-amber"}`}>
                    {alert.status === "triggered" ? "ausgelöst" : syncMode === "supabase" ? (alert.enabled ? "erstellt" : "pausiert") : "Demo / lokal"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAlert(alert)}
                    className={`h-8 w-14 rounded-full border p-1 transition ${
                      alert.enabled ? "border-profit/50 bg-profit/20" : "border-stroke bg-ink"
                    }`}
                    aria-label={`${alert.symbol} Alert umschalten`}
                    title="Alert umschalten"
                  >
                    <span
                      className={`block h-5 w-5 rounded-full transition ${
                        alert.enabled ? "translate-x-6 bg-profit" : "translate-x-0 bg-muted"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAlert(alert.id)}
                    className="grid h-9 w-9 place-items-center rounded-md border border-stroke text-muted transition hover:border-loss/40 hover:text-loss"
                    aria-label={`${alert.symbol} Alert löschen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 rounded-md bg-panel2 px-3 py-2 text-sm text-mist">{alert.condition}</p>
                <p className="mt-2 text-xs text-muted">
                  Schwelle: {alert.threshold ?? "n/a"} · Frequenz: {alert.frequency ?? "manual"} · Kanal: {alert.notificationChannel ?? "none"} · Status: {alert.status ?? (alert.enabled ? "created" : "paused")}
                </p>
                {evaluationLog[alert.id] ? (
                  <p className="mt-2 rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs leading-5 text-cyan">
                    {evaluationLog[alert.id]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
