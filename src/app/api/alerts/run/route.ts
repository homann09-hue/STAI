import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { hasPrivilegedAccess } from "@/lib/admin-access";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import type { MarketDataProvider } from "@/lib/providers/market-provider";
import type { AssetDetail, NormalizedQuote } from "@/lib/types";

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

type AlertTriggerSource = "provider" | "simulation";

function authorize(request: Request) {
  if (hasPrivilegedAccess(request, "alert_worker")) return null;
  return jsonError("Cron nicht autorisiert.", 401);
}

function isSimulatedAlertWorkerEnabled() {
  return /^(1|true|yes|enabled)$/i.test(process.env.STOCKPILOT_ENABLE_SIMULATED_ALERT_WORKER ?? "");
}

function simulatedValue(alert: AlertRow) {
  if (alert.alert_type === "price") return 150;
  if (alert.alert_type === "rsi") return 72;
  if (alert.alert_type === "volume") return 2.4;
  if (alert.alert_type === "portfolio-risk") return 68;
  if (alert.alert_type === "ai-risk") return 74;
  return null;
}

function shouldTrigger(alert: AlertRow, value: number) {
  const threshold = Number(alert.condition?.threshold);
  if (!Number.isFinite(threshold)) return false;
  const condition = alert.condition?.text?.toLowerCase() ?? "";
  if (condition.includes("unter") || condition.includes("<")) return value <= threshold;
  return value >= threshold;
}

function quoteValueForAlert(alert: AlertRow, quote: NormalizedQuote | null, assetDetail?: AssetDetail | null) {
  if (alert.alert_type === "price") return quote?.price ?? null;
  if (alert.alert_type === "volume") return quote?.volume ?? 0;
  if (alert.alert_type === "rsi") return assetDetail?.indicators?.rsi ?? null;
  return null;
}

async function loadAssetDetails(provider: MarketDataProvider, symbols: string[]) {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const detail = await provider.getAsset(symbol);
        return [symbol, detail] as const;
      } catch (error) {
        logEvent("warn", "alerts.worker_asset_detail_error", {
          symbol,
          error,
          provider: provider.providerName
        });
        return [symbol, null] as const;
      }
    })
  );

  return new Map(entries);
}

function eventSourceLabel(source: AlertTriggerSource) {
  return source === "provider" ? "Echtzeit-Provider" : "Simulation";
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
  const symbols = [...new Set(alerts.map((alert) => alert.symbol.trim().toUpperCase()).filter(Boolean))];
  const provider = getMarketDataProvider();
  let quotes: NormalizedQuote[] = [];
  let providerError: unknown = null;

  try {
    quotes = await provider.getQuotes(symbols);
  } catch (err) {
    providerError = err;
    logEvent("warn", "alerts.worker_provider_error", {
      error: err,
      symbols: symbols.slice(0, 20),
      provider: provider.providerName
    });
  }

  const quoteMap = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]));
  const rsiSymbols = [...new Set(alerts.filter((alert) => alert.alert_type === "rsi").map((alert) => alert.symbol.trim().toUpperCase()).filter(Boolean))];
  const assetDetails = rsiSymbols.length ? await loadAssetDetails(provider, rsiSymbols) : new Map<string, AssetDetail | null>();
  const simulatedEnabled = isSimulatedAlertWorkerEnabled();
  const triggeredAlerts: Array<{ alert: AlertRow; source: AlertTriggerSource; quote?: NormalizedQuote | null }> = [];

  for (const alert of alerts) {
    const symbolKey = alert.symbol.trim().toUpperCase();
    const quote = quoteMap.get(symbolKey) ?? null;
    const assetDetail = assetDetails.get(symbolKey) ?? null;
    const providerValue = quoteValueForAlert(alert, quote, assetDetail);

    if (providerValue !== null && shouldTrigger(alert, providerValue)) {
      triggeredAlerts.push({ alert, source: "provider", quote });
      continue;
    }

    if (simulatedEnabled) {
      const simulated = simulatedValue(alert);
      if (simulated !== null && shouldTrigger(alert, simulated)) {
        triggeredAlerts.push({ alert, source: "simulation" });
      }
    }
  }

  if (!simulatedEnabled && providerError) {
    logEvent("error", "alerts.worker_provider_unavailable", {
      provider: provider.providerName,
      error: providerError,
      checked: alerts.length
    });
  }

  if (triggeredAlerts.length === 0) {
    logEvent("info", "alerts.worker_run", {
      checked: alerts.length,
      triggered: 0,
      provider: provider.providerName,
      simulated: simulatedEnabled
    });

    return {
      mode: simulatedEnabled ? "provider_checked" : "dry_run",
      checked: alerts.length,
      triggered: 0,
      wouldTrigger: 0,
      simulated: simulatedEnabled,
      persisted: false,
      message: simulatedEnabled
        ? "Alert-Worker hat echte Providerwerte geprüft, aber keine Alerts ausgelöst."
        : "Alert-Worker hat echte Providerwerte geprüft, aber keine Events geschrieben. Simulierte Providerwerte werden nur mit STOCKPILOT_ENABLE_SIMULATED_ALERT_WORKER=true persistiert."
    };
  }

  const { error: insertError } = await supabase.from("alert_events").insert(
    triggeredAlerts.map(({ alert, source, quote }) => ({
      user_id: alert.user_id,
      alert_rule_id: alert.id,
      symbol: alert.symbol,
      event_type: alert.alert_type,
      payload: {
        condition: alert.condition,
        simulated: source === "simulation",
        source: eventSourceLabel(source),
        quote: source === "provider" ? quote : undefined,
        note:
          source === "provider"
            ? "Providerdaten wurden zur Auslösung herangezogen."
            : "STAI Worker-Architektur: echte Providerwerte können hier serverseitig eingehängt werden."
      }
    }))
  );

  if (insertError) throw insertError;

  const notifications = triggeredAlerts
    .map(({ alert, source, quote }) => {
      const channel = typeof alert.condition?.notificationChannel === "string" ? alert.condition.notificationChannel : "none";
      if (!["in_app", "email", "push", "webhook"].includes(channel)) return null;

      const channelLabel = channel === "in_app" ? "In-App" : channel === "email" ? "E-Mail" : channel === "push" ? "Push" : "Webhook";
      const conditionLabel = typeof alert.condition?.text === "string" ? alert.condition.text : `Schwelle ${alert.condition?.threshold ?? "unbekannt"}`;
      const sourceLabel = source === "provider" ? "Echtzeit-Provider" : "Simulation";

      return {
        user_id: alert.user_id,
        category: "alert",
        severity: "warning",
        title: `Alert ausgelöst: ${alert.symbol}`,
        message: `Dein ${alert.alert_type} Alert wurde von ${sourceLabel} ausgelöst (${conditionLabel}). Kanal: ${channelLabel}. Externe Zustellung ist noch nicht konfiguriert.`,
        href: "/alerts",
        source: "Alert Worker",
        status: "new"
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (notifications.length) {
    const { error: notificationError } = await supabase.from("notifications").insert(notifications);
    if (notificationError) throw notificationError;
  }

  logEvent("info", "alerts.worker_run", {
    checked: alerts.length,
    triggered: triggeredAlerts.length,
    provider: provider.providerName,
    simulated: simulatedEnabled,
    sourceCounts: triggeredAlerts.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {})
  });

  return {
    mode: "completed",
    checked: alerts.length,
    triggered: triggeredAlerts.length,
    simulated: simulatedEnabled,
    persisted: true,
    message: `Alert-Worker hat ${triggeredAlerts.length} Alerts ausgelöst und als Events persistiert.`,
    provider: provider.providerName
  };
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

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
