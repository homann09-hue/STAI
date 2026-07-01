"use client";

import { Bell, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { OFFLINE_KEYS, saveOfflineValue } from "@/lib/offline";
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
  const [syncMode, setSyncMode] = useState<"demo" | "supabase">("demo");
  const [syncStatus, setSyncStatus] = useState("Lokaler Demo-Modus aktiv. Alerts werden nicht serverseitig ausgeführt.");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.alerts, alerts);
  }, [alerts]);

  useEffect(() => {
    let cancelled = false;

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
      frequency: "manual" as const,
      notificationChannel: "none" as const
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
          <h2 className="mb-3 text-lg font-semibold">Aktive Regeln</h2>
          <div className="space-y-3" data-testid="alert-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-stroke bg-panel p-4" data-testid="alert-rule">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{alert.symbol}</p>
                    <p className="mt-1 text-sm text-muted">{alert.label}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-[11px] ${syncMode === "supabase" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-amber/30 bg-amber/10 text-amber"}`}>
                    {syncMode === "supabase" ? (alert.enabled ? "erstellt" : "pausiert") : "Demo / nicht aktiv"}
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
                </div>
                <p className="mt-3 rounded-md bg-panel2 px-3 py-2 text-sm text-mist">{alert.condition}</p>
                <p className="mt-2 text-xs text-muted">
                  Frequenz: {alert.frequency ?? "manual"} · Kanal: {alert.notificationChannel ?? "none"} · Status: {alert.status ?? (alert.enabled ? "created" : "paused")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
