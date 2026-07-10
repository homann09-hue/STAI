"use client";

import { ArrowUpDown, Bell, Copy, Download, History, PauseCircle, Play, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type AlertPreset = {
  label: string;
  description: string;
  symbol: string;
  type: AlertType;
  condition: string;
  threshold: string;
  frequency: "manual" | "10s" | "30s" | "60s" | "5min";
  notificationChannel: "none" | "in_app" | "email" | "push" | "webhook";
};

const alertFrequencies = new Set<AlertPreset["frequency"]>(["manual", "10s", "30s", "60s", "5min"]);
const notificationChannels = new Set<AlertPreset["notificationChannel"]>(["none", "in_app", "email", "push", "webhook"]);

function safePresetText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[<>\u0000-\u001F\u007F]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || fallback;
}

function normalizeImportedPreset(value: unknown): AlertPreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<AlertPreset>;
  const symbol = normalizeSymbolInput(typeof candidate.symbol === "string" ? candidate.symbol : "");
  const alertType = alertTypes.find((item) => item.value === candidate.type)?.value;

  if (!symbol.ok || !alertType) return null;

  return {
    label: safePresetText(candidate.label, `${symbol.symbol} Alarm`, 50),
    description: safePresetText(candidate.description, "Lokale Alert-Vorlage. Keine echte Ausführung ohne Worker.", 100),
    symbol: symbol.symbol,
    type: alertType,
    condition: safePresetText(candidate.condition, "Bedingung prüfen", 120),
    threshold: safePresetText(candidate.threshold, "0", 30).replace(/[^0-9.,+-]/g, "").slice(0, 30) || "0",
    frequency: alertFrequencies.has(candidate.frequency as AlertPreset["frequency"]) ? (candidate.frequency as AlertPreset["frequency"]) : "manual",
    notificationChannel: notificationChannels.has(candidate.notificationChannel as AlertPreset["notificationChannel"])
      ? (candidate.notificationChannel as AlertPreset["notificationChannel"])
      : "none"
  };
}

const alertPresets: AlertPreset[] = [
  {
    label: "Preis über Ziel",
    description: "Klassischer Kursalarm für Watchlist-Kandidaten.",
    symbol: "NVDA",
    type: "price",
    condition: "über 155 USD",
    threshold: "155",
    frequency: "60s",
    notificationChannel: "in_app"
  },
  {
    label: "RSI überkauft",
    description: "Technischer Warnbereich, keine Verkaufsentscheidung.",
    symbol: "AAPL",
    type: "rsi",
    condition: "über 70",
    threshold: "70",
    frequency: "5min",
    notificationChannel: "in_app"
  },
  {
    label: "Volumenanstieg",
    description: "Erkennt ungewöhnliche Aktivität im Demo-Modell.",
    symbol: "TSLA",
    type: "volume",
    condition: "über 2x Durchschnitt",
    threshold: "2",
    frequency: "5min",
    notificationChannel: "in_app"
  },
  {
    label: "KI-Risiko hoch",
    description: "Risikowarnung für modellbasierte Einschätzung.",
    symbol: "BTCUSD",
    type: "ai-risk",
    condition: "über 75",
    threshold: "75",
    frequency: "manual",
    notificationChannel: "none"
  }
];

const ALERT_HISTORY_KEY = "stockpilot:alert-history";
const ALERT_FILTER_KEY = "stockpilot:alert-filter";
const CUSTOM_ALERT_PRESETS_KEY = "stockpilot:custom-alert-presets";

type AlertHistoryItem = {
  id: string;
  alertId: string;
  symbol: string;
  type: AlertType;
  status: AlertRule["status"];
  checkedAt: string;
  message: string;
};

type AlertFilter = "all" | "enabled" | "paused" | "triggered" | "unavailable";
type AlertSort = "symbol" | "type" | "status";

const alertFilterOptions: Array<{ value: AlertFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "enabled", label: "Aktiv" },
  { value: "paused", label: "Pausiert" },
  { value: "triggered", label: "Ausgelöst" },
  { value: "unavailable", label: "Nicht verfügbar" }
];

const alertSortOptions: Array<{ value: AlertSort; label: string }> = [
  { value: "symbol", label: "Symbol" },
  { value: "type", label: "Typ" },
  { value: "status", label: "Status" }
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
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [customAlertPresets, setCustomAlertPresets] = useState<AlertPreset[]>([]);
  const [customPresetsReady, setCustomPresetsReady] = useState(false);
  const [customPresetImportText, setCustomPresetImportText] = useState("");
  const [customPresetImportError, setCustomPresetImportError] = useState("");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [alertSearch, setAlertSearch] = useState("");
  const [alertSort, setAlertSort] = useState<AlertSort>("symbol");
  const [syncMode, setSyncMode] = useState<"demo" | "supabase">("demo");
  const [syncStatus, setSyncStatus] = useState("Lokaler Demo-Modus aktiv. Alerts werden nicht serverseitig ausgeführt.");
  const [formError, setFormError] = useState("");
  const alertStats = {
    enabled: alerts.filter((alert) => alert.enabled).length,
    paused: alerts.filter((alert) => !alert.enabled).length,
    triggered: alerts.filter((alert) => alert.status === "triggered").length,
    unavailable: alerts.filter((alert) => alert.status === "unavailable").length
  };
  const selectedAlertTypeLabel = alertTypes.find((item) => item.value === type)?.label ?? "Alarm";
  const channelReadiness =
    notificationChannel === "none"
      ? {
          label: "Kein externer Kanal",
          tone: "border-amber/25 bg-amber/10 text-amber",
          text: "Diese Regel bleibt lokal sichtbar. Es erfolgt keine Push-, E-Mail- oder Webhook-Zustellung."
        }
      : notificationChannel === "in_app"
        ? {
            label: "In-App vorbereitet",
            tone: "border-cyan/25 bg-cyan/10 text-cyan",
            text: "In-App-Hinweise sind vorbereitet. Echte serverseitige Ausführung braucht den Alert-Worker."
          }
        : {
            label: "Kanal vorbereitet",
            tone: "border-amber/25 bg-amber/10 text-amber",
            text: "E-Mail, Push und Webhook brauchen Backend-Worker sowie bestaetigte Nutzer- und Berechtigungsdaten."
          };
  const parsedThresholdPreview = Number(threshold);
  const thresholdPreviewText = Number.isFinite(parsedThresholdPreview)
    ? parsedThresholdPreview.toLocaleString("de-DE")
    : "nicht numerisch";
  const rawSymbolPreview = symbol.trim().toUpperCase();
  const sanitizedSymbolPreview = rawSymbolPreview.replace(/[^A-Z0-9.\-:/]/g, "").slice(0, 18);
  const trimmedThresholdPreview = threshold.trim();
  const hasNumericThresholdPreview = trimmedThresholdPreview.length > 0 && Number.isFinite(Number(trimmedThresholdPreview));
  const formPreviewIssues = [
    rawSymbolPreview ? "" : "Symbol fehlt.",
    rawSymbolPreview && rawSymbolPreview !== sanitizedSymbolPreview ? "Symbol enthält Zeichen, die beim Speichern bereinigt werden." : "",
    hasNumericThresholdPreview ? "" : "Schwelle muss eine Zahl sein.",
    notificationChannel === "none" ? "Kein externer Benachrichtigungskanal aktiv." : ""
  ].filter(Boolean);
  const canCreateAlert = rawSymbolPreview.length > 0 && rawSymbolPreview === sanitizedSymbolPreview && hasNumericThresholdPreview;
  const blockingFormPreviewIssues = formPreviewIssues.filter((issue) => issue !== "Kein externer Benachrichtigungskanal aktiv.");
  const createAlertHint = canCreateAlert
    ? "Bereit zum Speichern als lokale Demo-Regel. Echte Ausführung hängt vom Alert-Worker ab."
    : blockingFormPreviewIssues.join(" ");
  const visibleAlerts = useMemo(() => {
    const query = alertSearch.trim().toLowerCase();

    return alerts.filter((alert) => {
      if (alertFilter === "enabled" && !alert.enabled) return false;
      if (alertFilter === "paused" && alert.enabled) return false;
      if (alertFilter === "triggered" && alert.status !== "triggered") return false;
      if (alertFilter === "unavailable" && alert.status !== "unavailable") return false;
      if (!query) return true;
      return `${alert.symbol} ${alert.label} ${alert.condition} ${alert.type}`.toLowerCase().includes(query);
    }).sort((a, b) => {
      if (alertSort === "type") return a.type.localeCompare(b.type) || a.symbol.localeCompare(b.symbol);
      if (alertSort === "status") return (a.status ?? "").localeCompare(b.status ?? "") || a.symbol.localeCompare(b.symbol);
      return a.symbol.localeCompare(b.symbol);
    });
  }, [alertFilter, alertSearch, alertSort, alerts]);
  const customPresetImportPreview = useMemo(() => {
    if (!customPresetImportText.trim()) return null;
    if (customPresetImportText.length > 40_000) return { ok: false, message: "Import zu groß. Maximal 40 KB erlaubt." };

    try {
      const parsed = JSON.parse(customPresetImportText) as { presets?: unknown };
      if (!Array.isArray(parsed.presets)) return { ok: false, message: "Keine presets-Liste gefunden." };

      const previewPresets = parsed.presets.slice(0, 100);
      const validCount = previewPresets.filter((preset) => {
        const candidate = preset as Partial<AlertPreset>;
        return Boolean(
          candidate &&
            typeof candidate.label === "string" &&
            typeof candidate.symbol === "string" &&
            typeof candidate.type === "string" &&
            alertTypes.some((item) => item.value === candidate.type)
        );
      }).length;

      return {
        ok: validCount > 0,
        message: `${validCount} gültige Vorlage(n) erkannt. Maximal 12 eigene Vorlagen werden lokal gespeichert.`
      };
    } catch {
      return { ok: false, message: "JSON ist noch nicht lesbar." };
    }
  }, [customPresetImportText]);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.alerts, alerts);
  }, [alerts]);

  useEffect(() => {
    const stored = readOfflineValue<{ filter?: AlertFilter; search?: string; sort?: AlertSort }>(ALERT_FILTER_KEY);
    if (!stored) return;
    if (stored.filter && alertFilterOptions.some((option) => option.value === stored.filter)) setAlertFilter(stored.filter);
    if (typeof stored.search === "string") setAlertSearch(stored.search.slice(0, 80));
    if (stored.sort && alertSortOptions.some((option) => option.value === stored.sort)) setAlertSort(stored.sort);
  }, []);

  useEffect(() => {
    saveOfflineValue(ALERT_FILTER_KEY, { filter: alertFilter, search: alertSearch, sort: alertSort });
  }, [alertFilter, alertSearch, alertSort]);

  useEffect(() => {
    const storedPresets = readOfflineValue<AlertPreset[]>(CUSTOM_ALERT_PRESETS_KEY);
    if (storedPresets?.length) setCustomAlertPresets(storedPresets.slice(0, 12));
    setCustomPresetsReady(true);
  }, []);

  useEffect(() => {
    if (!customPresetsReady) return;
    saveOfflineValue(CUSTOM_ALERT_PRESETS_KEY, customAlertPresets.slice(0, 12));
  }, [customAlertPresets, customPresetsReady]);

  useEffect(() => {
    let cancelled = false;
    const stored = readOfflineValue<AlertRule[]>(OFFLINE_KEYS.alerts);
    const storedHistory = readOfflineValue<AlertHistoryItem[]>(ALERT_HISTORY_KEY);

    if (stored?.length) {
      setAlerts(stored);
      setSyncStatus("Lokale Offline-Alerts geladen. Serverseitige Ausführung nicht aktiv.");
    }
    if (storedHistory?.length) setHistory(storedHistory.slice(0, 50));

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

  useEffect(() => {
    saveOfflineValue(ALERT_HISTORY_KEY, history.slice(0, 50));
  }, [history]);

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
    const nextHistory: AlertHistoryItem[] = [];
    const nextAlerts: AlertRule[] = alerts.map((alert) => {
      if (!alert.enabled) {
        nextLog[alert.id] = "Pausiert. Keine Prüfung durchgeführt.";
        nextHistory.push({
          id: `${alert.id}-${checkedAt}`,
          alertId: alert.id,
          symbol: alert.symbol,
          type: alert.type,
          status: "paused",
          checkedAt,
          message: nextLog[alert.id]
        });
        return { ...alert, status: "paused" as const };
      }

      const demoValue = demoValueFor(alert);
      if (demoValue === null) {
        nextLog[alert.id] = "Regel gespeichert. Echte Auslösung braucht News-, Earnings- oder KI-Worker.";
        nextHistory.push({
          id: `${alert.id}-${checkedAt}`,
          alertId: alert.id,
          symbol: alert.symbol,
          type: alert.type,
          status: "unavailable",
          checkedAt,
          message: nextLog[alert.id]
        });
        return { ...alert, status: "unavailable" as const };
      }

      const triggered = shouldTrigger(alert);
      const status: AlertRule["status"] = triggered ? "triggered" : "created";
      nextLog[alert.id] = `Lokale Prüfung: Modellwert ${demoValue}, Schwelle ${alert.threshold ?? "n/a"} -> ${triggered ? "ausgelöst" : "nicht ausgelöst"}.`;
      nextHistory.push({
        id: `${alert.id}-${checkedAt}`,
        alertId: alert.id,
        symbol: alert.symbol,
        type: alert.type,
        status,
        checkedAt,
        message: nextLog[alert.id]
      });
      return { ...alert, status };
    });

    setAlerts(nextAlerts);
    setEvaluationLog(nextLog);
    setHistory((current) => [...nextHistory, ...current].slice(0, 50));
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

  function duplicateAlert(alert: AlertRule) {
    setAlerts((current) => [
      {
        ...alert,
        id: `local-copy-${Date.now()}`,
        label: `${alert.label} Kopie`.slice(0, 80),
        enabled: false,
        status: "paused"
      },
      ...current
    ]);
    setSyncMode("demo");
    setSyncStatus("Alert lokal dupliziert und pausiert. Bitte Schwelle, Frequenz und Kanal prüfen.");
  }

  function loadAlertAsTemplate(alert: AlertRule) {
    setSymbol(alert.symbol);
    setType(alert.type);
    setCondition(alert.condition);
    setThreshold(alert.threshold !== undefined ? String(alert.threshold) : "");
    setFrequency((alert.frequency ?? "manual") as "manual" | "10s" | "30s" | "60s" | "5min");
    setNotificationChannel((alert.notificationChannel ?? "none") as "none" | "in_app" | "email" | "push" | "webhook");
    setFormError("");
    setSyncStatus("Alert als Vorlage in das Formular geladen. Speichern erstellt eine neue lokale Regel.");
  }

  function applyPreset(preset: (typeof alertPresets)[number]) {
    setSymbol(preset.symbol);
    setType(preset.type);
    setCondition(preset.condition);
    setThreshold(preset.threshold);
    setFrequency(preset.frequency);
    setNotificationChannel(preset.notificationChannel);
    setFormError("");
    setSyncStatus(`Preset "${preset.label}" geladen. Speichern erstellt eine neue lokale Demo-Regel.`);
  }

  function saveCurrentPreset() {
    const normalized = normalizeSymbolInput(symbol);
    const selected = alertTypes.find((item) => item.value === type);
    setFormError("");

    if (!normalized.ok) {
      setFormError(normalized.message);
      return;
    }

    const nextPreset: AlertPreset = {
      label: `${normalized.symbol} ${selected?.label ?? "Alert"}`.slice(0, 50),
      description: `Eigene Vorlage: ${condition.replace(/[<>]/g, "").slice(0, 80) || "Bedingung prüfen"}`,
      symbol: normalized.symbol,
      type,
      condition: condition.replace(/[<>]/g, "").slice(0, 120),
      threshold,
      frequency,
      notificationChannel
    };

    setCustomAlertPresets((current) => [
      nextPreset,
      ...current.filter((preset) => preset.label !== nextPreset.label).slice(0, 11)
    ]);
    setSyncStatus("Eigene Alert-Vorlage lokal gespeichert. Sie erstellt keine aktive Regel, bis du bewusst speicherst.");
  }

  function deleteCustomPreset(label: string) {
    setCustomAlertPresets((current) => current.filter((preset) => preset.label !== label));
    setSyncStatus("Eigene Alert-Vorlage lokal gelöscht.");
  }

  function clearCustomPresets() {
    setCustomAlertPresets([]);
    setCustomPresetImportText("");
    setCustomPresetImportError("");
    setSyncStatus("Alle eigenen Alert-Vorlagen lokal gelöscht.");
  }

  function exportCustomPresets() {
    const payload = {
      app: "StockPilot AI",
      exportedAt: new Date().toISOString(),
      disclaimer: "Lokale Alert-Vorlagen. Import erstellt keine aktiven Alerts und sendet keine Benachrichtigungen.",
      presets: customAlertPresets
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stockpilot-alert-presets.json";
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus("Eigene Alert-Vorlagen lokal exportiert.");
  }

  function importCustomPresets() {
    setCustomPresetImportError("");

    if (customPresetImportText.length > 40_000) {
      setCustomPresetImportError("Import zu groß. Bitte maximal 40 KB importieren.");
      return;
    }

    try {
      const parsed = JSON.parse(customPresetImportText) as { presets?: unknown };
      if (!Array.isArray(parsed.presets)) {
        setCustomPresetImportError("Import ungültig: presets-Liste fehlt.");
        return;
      }

      const validPresets = parsed.presets
        .slice(0, 100)
        .map(normalizeImportedPreset)
        .filter((preset): preset is AlertPreset => Boolean(preset));

      if (!validPresets.length) {
        setCustomPresetImportError("Import enthält keine gültigen Alert-Vorlagen.");
        return;
      }

      setCustomAlertPresets((current) => {
        const merged = [...validPresets, ...current];
        const unique = new Map<string, AlertPreset>();
        merged.forEach((preset) => unique.set(preset.label, preset));
        return Array.from(unique.values()).slice(0, 12);
      });
      setCustomPresetImportText("");
      setSyncStatus(`${validPresets.length} eigene Alert-Vorlage(n) lokal importiert. Es wurden keine aktiven Alerts erstellt.`);
    } catch {
      setCustomPresetImportError("Import konnte nicht gelesen werden. Bitte gültiges StockPilot-JSON verwenden.");
    }
  }

  function setAllAlertsEnabled(enabled: boolean) {
    setAlerts((current) => current.map((alert) => ({ ...alert, enabled, status: enabled ? "created" : "paused" })));
    setSyncMode("demo");
    setSyncStatus(enabled ? "Alle lokalen Alerts aktiviert. Serverseitige Ausführung braucht weiterhin einen Worker." : "Alle lokalen Alerts pausiert.");
  }

  function exportAlertHistory() {
    const payload = {
      app: "StockPilot AI",
      exportedAt: new Date().toISOString(),
      mode: syncMode,
      disclaimer: "Lokaler Alert-Export. Keine Garantie für Auslösung, Zustellung oder Investment-Ergebnis.",
      alerts,
      history
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stockpilot-alerts-history.json";
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus("Alert-Historie lokal exportiert. Export ist keine serverseitige Ausführungsbestätigung.");
  }

  function exportVisibleAlertsCsv() {
    const escapeCsv = (value: string | number | boolean | undefined) => {
      const raw = String(value ?? "");
      const guarded = /^[=+\-@\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw;
      return `"${guarded.replace(/"/g, "\"\"")}"`;
    };
    const csv = [
      "Symbol,Typ,Label,Bedingung,Schwelle,Frequenz,Kanal,Aktiv,Status,Modus",
      ...visibleAlerts.map((alert) => [
        alert.symbol,
        alert.type,
        alert.label,
        alert.condition,
        alert.threshold,
        alert.frequency ?? "manual",
        alert.notificationChannel ?? "none",
        alert.enabled,
        alert.status ?? (alert.enabled ? "created" : "paused"),
        syncMode
      ].map(escapeCsv).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stockpilot-visible-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus("Gefilterte Alert-Liste als CSV exportiert. Export ist keine serverseitige Ausführungsbestätigung.");
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
            <div className="mb-4 rounded-2xl border border-stroke bg-coal/60 p-3">
              <p className="text-sm font-semibold text-mist">Schnellvorlagen</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Presets füllen nur das Formular. Du prüfst Schwelle, Frequenz und Kanal selbst vor dem Speichern.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {alertPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-xl border border-stroke bg-ink p-3 text-left transition hover:border-cyan/40 hover:bg-panel2"
                    title={preset.description}
                  >
                    <span className="block text-sm font-semibold text-mist">{preset.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{preset.description}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-stroke pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-mist">Eigene Vorlagen</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveCurrentPreset}
                      className="rounded-xl border border-profit/25 bg-profit/10 px-3 py-2 text-xs font-semibold text-profit"
                    >
                      Aktuelles Formular speichern
                    </button>
                    <button
                      type="button"
                      onClick={exportCustomPresets}
                      disabled={!customAlertPresets.length}
                      className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Vorlagen exportieren
                    </button>
                    <button
                      type="button"
                      onClick={clearCustomPresets}
                      disabled={!customAlertPresets.length}
                      className="rounded-xl border border-loss/25 bg-loss/10 px-3 py-2 text-xs font-semibold text-loss disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Alle löschen
                    </button>
                  </div>
                </div>
                {customAlertPresets.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {customAlertPresets.map((preset) => (
                      <div key={preset.label} className="rounded-xl border border-stroke bg-ink p-3">
                        <button
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="block w-full text-left"
                          title={preset.description}
                        >
                          <span className="block text-sm font-semibold text-mist">{preset.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted">{preset.description}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomPreset(preset.label)}
                          className="mt-3 rounded-full border border-stroke bg-coal px-3 py-1 text-xs font-semibold text-muted transition hover:text-loss"
                        >
                          Vorlage löschen
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-stroke bg-ink p-3 text-xs leading-5 text-muted">
                    Noch keine eigenen Vorlagen gespeichert.
                  </p>
                )}
                <div className="mt-3 rounded-xl border border-stroke bg-ink p-3">
                  <p className="text-xs font-semibold text-mist">Vorlagen importieren</p>
                  <textarea
                    value={customPresetImportText}
                    onChange={(event) => setCustomPresetImportText(event.target.value.slice(0, 40000))}
                    className="mt-2 min-h-20 w-full rounded-xl border border-stroke bg-coal p-3 font-mono text-xs text-mist outline-none focus:border-cyan"
                    placeholder="StockPilot Alert-Presets JSON hier einfügen..."
                  />
                  {customPresetImportPreview ? (
                    <p className={`mt-2 rounded-xl border p-2 text-xs leading-5 ${
                      customPresetImportPreview.ok ? "border-profit/25 bg-profit/10 text-profit" : "border-amber/25 bg-amber/10 text-amber"
                    }`}>
                      {customPresetImportPreview.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={importCustomPresets}
                    className="mt-2 rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan"
                  >
                    Vorlagen importieren
                  </button>
                  {customPresetImportError ? (
                    <p className="mt-2 rounded-xl border border-loss/25 bg-loss/10 p-2 text-xs leading-5 text-loss">
                      {customPresetImportError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
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

            <div className="mt-4 rounded-md border border-stroke bg-coal/60 p-3">
              <p className="text-sm font-semibold text-mist">Regel-Vorschau</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="rounded-md border border-stroke bg-graphite/70 px-3 py-2 text-xs text-muted">
                  Symbol <span className="ml-2 font-semibold text-mist">{sanitizedSymbolPreview || "n/a"}</span>
                </p>
                <p className="rounded-md border border-stroke bg-graphite/70 px-3 py-2 text-xs text-muted">
                  Typ <span className="ml-2 font-semibold text-mist">{selectedAlertTypeLabel}</span>
                </p>
                <p className="rounded-md border border-stroke bg-graphite/70 px-3 py-2 text-xs text-muted">
                  Bedingung <span className="ml-2 font-semibold text-mist">{condition || "n/a"}</span>
                </p>
                <p className="rounded-md border border-stroke bg-graphite/70 px-3 py-2 text-xs text-muted">
                  Schwelle <span className="ml-2 font-semibold text-mist">{thresholdPreviewText}</span>
                </p>
              </div>
              <p className={`mt-3 rounded-md border p-3 text-xs leading-5 ${channelReadiness.tone}`}>
                <span className="font-semibold">{channelReadiness.label}: </span>
                {channelReadiness.text}
              </p>
              {formPreviewIssues.length ? (
                <div className="mt-3 rounded-md border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
                  <p className="font-semibold">Vor dem Speichern prüfen</p>
                  <ul className="mt-2 list-inside list-disc">
                    {formPreviewIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-profit/25 bg-profit/10 p-3 text-xs leading-5 text-profit">
                  Eingaben sehen formal sauber aus. Die echte Ausführung bleibt abhängig von Datenanbieter, Worker und Berechtigungen.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-muted">
                Die Vorschau erstellt noch keine Regel. Sie hilft, fehlerhafte Symbole, unklare Schwellen und nicht aktive Benachrichtigungskanaele frueh zu erkennen.
              </p>
            </div>

            <button
              type="button"
              onClick={addAlert}
              disabled={!canCreateAlert}
              aria-describedby="alert-create-hint"
              title={canCreateAlert ? "Lokalen Demo-Alert erstellen" : "Bitte Symbol und numerische Schwelle prüfen."}
              className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md font-semibold transition ${
                canCreateAlert
                  ? "bg-profit text-ink hover:bg-profit/90"
                  : "cursor-not-allowed border border-stroke bg-graphite text-muted"
              }`}
            >
              <Plus className="h-4 w-4" />
              {canCreateAlert ? "Alert erstellen" : "Eingaben prüfen"}
            </button>
            <p id="alert-create-hint" className={`mt-2 text-xs leading-5 ${canCreateAlert ? "text-profit" : "text-amber"}`}>
              {createAlertHint}
            </p>
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
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runLocalCheck} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 font-semibold text-cyan">
                <Play className="h-4 w-4" />
                Lokal prüfen
              </button>
              <button type="button" onClick={() => setAllAlertsEnabled(false)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-4 font-semibold text-amber">
                <PauseCircle className="h-4 w-4" />
                Alle pausieren
              </button>
              <button type="button" onClick={() => setAllAlertsEnabled(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-profit/30 bg-profit/10 px-4 font-semibold text-profit">
                <Play className="h-4 w-4" />
                Alle aktivieren
              </button>
            </div>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-profit/20 bg-profit/10 p-3">
              <p className="text-xs text-muted">Aktiv</p>
              <p className="mt-1 font-mono text-xl font-semibold text-profit">{alertStats.enabled}</p>
            </div>
            <div className="rounded-xl border border-amber/20 bg-amber/10 p-3">
              <p className="text-xs text-muted">Pausiert</p>
              <p className="mt-1 font-mono text-xl font-semibold text-amber">{alertStats.paused}</p>
            </div>
            <div className="rounded-xl border border-loss/20 bg-loss/10 p-3">
              <p className="text-xs text-muted">Ausgelöst</p>
              <p className="mt-1 font-mono text-xl font-semibold text-loss">{alertStats.triggered}</p>
            </div>
            <div className="rounded-xl border border-stroke bg-coal p-3">
              <p className="text-xs text-muted">Nicht verfügbar</p>
              <p className="mt-1 font-mono text-xl font-semibold text-muted">{alertStats.unavailable}</p>
            </div>
          </div>
          {history.length ? (
            <div className="mb-4 rounded-md border border-stroke bg-panel p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-cyan" />
                  <h3 className="text-sm font-semibold text-mist">Alert-Historie</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="rounded-full border border-stroke bg-coal px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-mist"
                >
                  Historie leeren
                </button>
                <button
                  type="button"
                  onClick={exportAlertHistory}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
              <div className="space-y-2">
                {history.slice(0, 5).map((item) => (
                  <article key={item.id} className="rounded-xl border border-stroke bg-ink p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-mist">{item.symbol}</p>
                      <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-1 text-[10px] uppercase text-cyan">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{new Date(item.checkedAt).toLocaleString("de-DE")} · {item.type}</p>
                    <p className="mt-2 text-xs leading-5 text-muted">{item.message}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mb-4 rounded-md border border-stroke bg-panel p-3">
            <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
              <label className="relative block">
                <span className="sr-only">Alerts durchsuchen</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={alertSearch}
                  onChange={(event) => setAlertSearch(event.target.value.slice(0, 80))}
                  className="h-11 w-full rounded-xl border border-stroke bg-ink pl-10 pr-3 text-sm text-mist outline-none focus:border-cyan"
                  placeholder="Symbol, Typ, Label oder Bedingung suchen"
                />
              </label>
              <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Alert-Status filtern">
                {alertFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={alertFilter === option.value}
                    onClick={() => setAlertFilter(option.value)}
                    className={`h-11 shrink-0 rounded-xl border px-3 text-xs font-semibold transition ${
                      alertFilter === option.value ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-stroke bg-coal text-muted hover:text-mist"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                {visibleAlerts.length} von {alerts.length} Alert-Regeln sichtbar.
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-stroke bg-coal px-3 text-xs font-semibold text-muted">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span>Sortieren</span>
                  <select
                    value={alertSort}
                    onChange={(event) => setAlertSort(event.target.value as AlertSort)}
                    className="bg-transparent text-mist outline-none"
                    aria-label="Alerts sortieren"
                  >
                    {alertSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={exportVisibleAlertsCsv}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-profit/25 bg-profit/10 px-3 text-xs font-semibold text-profit"
                >
                  <Download className="h-3.5 w-3.5" />
                  Sichtbare CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlertFilter("all");
                    setAlertSearch("");
                    setAlertSort("symbol");
                  }}
                  className="inline-flex h-10 items-center rounded-xl border border-stroke bg-coal px-3 text-xs font-semibold text-muted transition hover:text-mist"
                >
                  Filter zurücksetzen
                </button>
              </div>
            </div>
            <p className="mt-2 rounded-xl border border-cyan/20 bg-cyan/10 p-3 text-xs leading-5 text-cyan">
              Suchtext, Filter und Sortierung werden lokal gespeichert. Serverseitige Alert-Ausführung braucht weiterhin einen Worker.
            </p>
          </div>
          <div className="space-y-3" data-testid="alert-list">
            {visibleAlerts.length ? visibleAlerts.map((alert) => (
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
                    onClick={() => duplicateAlert(alert)}
                    className="grid h-9 w-9 place-items-center rounded-md border border-stroke text-muted transition hover:border-cyan/40 hover:text-cyan"
                    aria-label={`${alert.symbol} Alert duplizieren`}
                    title="Alert duplizieren"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loadAlertAsTemplate(alert)}
                    className="h-9 rounded-md border border-stroke px-3 text-xs font-semibold text-muted transition hover:border-cyan/40 hover:text-cyan"
                    aria-label={`${alert.symbol} Alert als Vorlage laden`}
                    title="Als Vorlage laden"
                  >
                    Vorlage
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
            )) : (
              <p className="rounded-md border border-stroke bg-panel p-4 text-sm text-muted">
                Keine Alert-Regeln für diesen Filter gefunden.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
