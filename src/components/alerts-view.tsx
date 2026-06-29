"use client";

import { Bell, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { OFFLINE_KEYS, saveOfflineValue } from "@/lib/offline";
import type { AlertRule, AlertType } from "@/lib/types";

const alertTypes: { value: AlertType; label: string }[] = [
  { value: "price", label: "Kursalarm" },
  { value: "rsi", label: "RSI uber/unter Wert" },
  { value: "news", label: "Newsalarm" },
  { value: "volume", label: "Volumenanstieg" },
  { value: "earnings", label: "Earnings Reminder" },
  { value: "ai-risk", label: "KI-Risikoalarm" },
  { value: "ai-shift", label: "KI-Einschaetzung veraendert" },
  { value: "portfolio-risk", label: "Portfolio-Risikoalarm" }
];

export function AlertsView({ initialAlerts }: { initialAlerts: AlertRule[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [symbol, setSymbol] = useState("NVDA");
  const [type, setType] = useState<AlertType>("price");
  const [condition, setCondition] = useState("uber 155 USD");

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.alerts, alerts);
  }, [alerts]);

  function addAlert() {
    const selected = alertTypes.find((item) => item.value === type);
    setAlerts((current) => [
      {
        id: `local-${Date.now()}`,
        symbol: symbol.trim().toUpperCase(),
        type,
        label: selected?.label ?? "Alarm",
        condition,
        enabled: true
      },
      ...current
    ]);
  }

  return (
    <div className="space-y-7">
      <section className="rounded-md border border-stroke bg-[linear-gradient(140deg,#101712,#07100d_70%,#172114)] p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Alerts</p>
            <h1 className="mt-2 text-3xl font-semibold">Signal- und Risikoalarme</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Kurs, RSI, News, Volumen, Earnings und KI-Risiko sind als Regeln modelliert und konnen spater uber Supabase gespeichert werden.
            </p>
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
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Aktive Regeln</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-stroke bg-panel p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{alert.symbol}</p>
                    <p className="mt-1 text-sm text-muted">{alert.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAlerts((current) =>
                        current.map((item) =>
                          item.id === alert.id ? { ...item, enabled: !item.enabled } : item
                        )
                      )
                    }
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
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
