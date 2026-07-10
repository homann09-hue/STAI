"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConnectionBadge } from "@/components/live-market-widgets";
import { WatchlistTable } from "@/components/market-boxes";
import { readOfflineValue, saveOfflineValue, OFFLINE_KEYS } from "@/lib/offline";
import { refreshIntervals, defaultRefreshIntervalMs } from "@/lib/refresh-config";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import { useMarketStream } from "@/lib/use-market-stream";
import { normalizeSymbolInput } from "@/lib/validation";
import type { AssetSummary, AssetType } from "@/lib/types";

type WatchlistItem = {
  id?: string;
  symbol: string;
  asset_type?: AssetType;
  assetType?: AssetType;
};

const WATCHLIST_OVERRIDE_KEY = "stockpilot:watchlist-user-override";
const MAX_CLIENT_WATCHLIST_ITEMS = 500;
const MAX_SYMBOL_INPUT_CHARS = 32;
const assetTypes = new Set<AssetType>(["stock", "etf", "crypto", "forex", "index"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeAssetType(value: unknown): AssetType {
  return assetTypes.has(value as AssetType) ? (value as AssetType) : "stock";
}

function safeWatchlistItem(value: unknown): WatchlistItem | null {
  if (!isRecord(value)) return null;
  const parsed = normalizeSymbolInput(typeof value.symbol === "string" ? value.symbol : "");
  if (!parsed.ok) return null;

  return {
    id: typeof value.id === "string" ? value.id.slice(0, 96) : undefined,
    symbol: parsed.symbol,
    asset_type: safeAssetType(value.asset_type ?? value.assetType)
  };
}

function safeWatchlistItems(value: unknown): WatchlistItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: WatchlistItem[] = [];

  for (const candidate of value) {
    const item = safeWatchlistItem(candidate);
    if (!item || seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    items.push(item);
    if (items.length >= MAX_CLIENT_WATCHLIST_ITEMS) break;
  }

  return items;
}

function safeAssetSummary(value: unknown): AssetSummary | null {
  if (!isRecord(value) || !isRecord(value.asset)) return null;
  const parsed = normalizeSymbolInput(typeof value.asset.symbol === "string" ? value.asset.symbol : "");
  if (!parsed.ok) return null;

  const summary = value as unknown as AssetSummary;
  return {
    ...summary,
    asset: {
      ...summary.asset,
      symbol: parsed.symbol,
      type: safeAssetType(summary.asset.type)
    }
  };
}

function safeAssetSummaries(value: unknown): AssetSummary[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: AssetSummary[] = [];

  for (const candidate of value) {
    const item = safeAssetSummary(candidate);
    if (!item || seen.has(item.asset.symbol)) continue;
    seen.add(item.asset.symbol);
    items.push(item);
    if (items.length >= MAX_CLIENT_WATCHLIST_ITEMS) break;
  }

  return items;
}

function placeholderSummary(item: WatchlistItem): AssetSummary {
  const symbol = safeWatchlistItem(item)?.symbol ?? "UNKNOWN";
  const assetType = safeAssetType(item.asset_type ?? item.assetType);
  const now = new Date().toISOString();

  return {
    asset: {
      symbol,
      name: `${symbol} - Daten noch nicht geladen`,
      type: assetType,
      exchange: "unbekannt",
      currency: "USD",
      sector: "Nicht klassifiziert",
      description: "Lokaler Watchlist-Eintrag ohne geladenen Kurs. Keine Analyse oder Signalableitung."
    },
    quote: {
      price: 0,
      change: 0,
      changePercent: 0,
      dayHigh: 0,
      dayLow: 0,
      volume: 0,
      delayedByMinutes: 0,
      asOf: now,
      provider: "Nicht geladen",
      quality: "unavailable",
      marketStatus: "unknown"
    },
    scores: {
      trend: 50,
      news: 50,
      fundamental: 50,
      technical: 50,
      risk: 50,
      total: 50
    },
    aiRisk: "mittel"
  };
}

export function WatchlistSyncView({ initialItems }: { initialItems: AssetSummary[] }) {
  const [cloudItems, setCloudItems] = useState<WatchlistItem[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [offlineItems, setOfflineItems] = useState<AssetSummary[]>([]);
  const [offlineReady, setOfflineReady] = useState(false);
  const [syncMode, setSyncMode] = useState<"local" | "supabase">("local");
  const [syncStatus, setSyncStatus] = useState("Lokaler Demo-/Offline-Modus aktiv.");
  const [inputError, setInputError] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(defaultRefreshIntervalMs);
  const [deletedLocalSymbols, setDeletedLocalSymbols] = useState<Set<string>>(() => new Set());
  const [hasUserWatchlistOverride, setHasUserWatchlistOverride] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  const visibleItems = useMemo(() => {
    const removeDeleted = (items: AssetSummary[]) =>
      items.filter((item) => !deletedLocalSymbols.has(item.asset.symbol.toUpperCase()));

    if (cloudReady && syncMode === "supabase") {
      return removeDeleted(cloudItems.map((item) => {
        const normalized = item.symbol.toUpperCase();
        return initialItems.find((summary) => summary.asset.symbol === normalized) ?? placeholderSummary(item);
      }));
    }

    if (cloudItems.length) {
      return removeDeleted(cloudItems.map((item) => {
        const normalized = item.symbol.toUpperCase();
        return initialItems.find((summary) => summary.asset.symbol === normalized) ?? placeholderSummary(item);
      }));
    }

    if (offlineItems.length || hasUserWatchlistOverride) return removeDeleted(offlineItems);
    return removeDeleted(initialItems);
  }, [cloudItems, cloudReady, deletedLocalSymbols, hasUserWatchlistOverride, initialItems, offlineItems, syncMode]);
  const visibleSymbols = useMemo(
    () => [...new Set(visibleItems.slice(0, 30).map((item) => item.asset.symbol))],
    [visibleItems]
  );
  const stream = useMarketStream(visibleSymbols, visibleSymbols.length > 0, refreshInterval);

  useEffect(() => {
    if (!offlineReady || !hasUserWatchlistOverride) return;
    saveOfflineValue(OFFLINE_KEYS.watchlist, visibleItems);
  }, [hasUserWatchlistOverride, offlineReady, visibleItems]);

  useEffect(() => {
    if (!offlineReady) return;
    saveOfflineValue(WATCHLIST_OVERRIDE_KEY, hasUserWatchlistOverride);
  }, [hasUserWatchlistOverride, offlineReady]);

  useEffect(() => {
    let cancelled = false;
    const stored = safeAssetSummaries(readOfflineValue<AssetSummary[]>(OFFLINE_KEYS.watchlist));
    const storedOverride = readOfflineValue<boolean>(WATCHLIST_OVERRIDE_KEY);

    if (storedOverride || stored.length) {
      setHasUserWatchlistOverride(true);
    }

    if (stored.length) {
      setOfflineItems(stored);
      if (!navigator.onLine) setSyncStatus("Offline-Watchlist aus lokalem Speicher geladen.");
    }
    setOfflineReady(true);

    fetchWithSupabaseAuth("/api/watchlist")
      .then((response) => response.json())
      .then((data: { items?: WatchlistItem[]; mode?: string }) => {
        if (cancelled) return;
        if (data.mode === "supabase") {
          setCloudItems(safeWatchlistItems(data.items));
          setCloudReady(true);
          setSyncMode("supabase");
          setSyncStatus("Supabase-Cloud-Sync aktiv. Watchlist wird nutzerbezogen gespeichert.");
          return;
        }

        setCloudItems([]);
        setCloudReady(false);
        setSyncMode("local");
        setSyncStatus("Kein Supabase-Login. Lokaler Demo-/Offline-Modus aktiv.");
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = readOfflineValue<AssetSummary[]>(OFFLINE_KEYS.watchlist);
          const safeFallback = safeAssetSummaries(fallback);
          if (safeFallback.length) setOfflineItems(safeFallback);
          setCloudReady(false);
          setSyncMode("local");
          setSyncStatus(safeFallback.length ? "Offline-Watchlist aus lokalem Speicher geladen." : "Supabase nicht erreichbar. Lokale Demo-Watchlist aktiv.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function addSymbol() {
    const normalized = normalizeSymbolInput(symbol);
    setInputError("");

    if (!normalized.ok) {
      setInputError(normalized.message);
      return;
    }

    const normalizedSymbol = normalized.symbol;
    const alreadyExists = visibleItems.some((item) => item.asset.symbol === normalizedSymbol) ||
      cloudItems.some((item) => item.symbol.toUpperCase() === normalizedSymbol);

    if (alreadyExists) {
      setInputError("Symbol ist bereits in der Watchlist.");
      return;
    }

    try {
      const response = await fetchWithSupabaseAuth("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: normalizedSymbol, assetType })
      });
      if (!response.ok) throw new Error("watchlist mutation not authenticated");
      const data = await response.json() as { item?: WatchlistItem; mode?: string };
      const safeItem = safeWatchlistItem(data.item) ?? { symbol: normalizedSymbol, asset_type: assetType };
      setDeletedLocalSymbols((current) => {
        const next = new Set(current);
        next.delete(normalizedSymbol);
        return next;
      });
      setHasUserWatchlistOverride(true);
      setCloudItems((current) => [safeItem, ...current.filter((item) => item.symbol !== normalizedSymbol)].slice(0, MAX_CLIENT_WATCHLIST_ITEMS));
      setSyncMode(data.mode === "supabase" ? "supabase" : "local");
      setSyncStatus(data.mode === "supabase" ? "Symbol in Supabase gespeichert." : "Symbol lokal gespeichert. Cloud-Sync nicht aktiv.");
    } catch {
      setDeletedLocalSymbols((current) => {
        const next = new Set(current);
        next.delete(normalizedSymbol);
        return next;
      });
      setHasUserWatchlistOverride(true);
      setCloudItems((current) => [{ symbol: normalizedSymbol, asset_type: assetType }, ...current.filter((item) => item.symbol !== normalizedSymbol)].slice(0, MAX_CLIENT_WATCHLIST_ITEMS));
      setSyncMode("local");
      setSyncStatus("Nicht eingeloggt oder Supabase nicht erreichbar. Symbol lokal gespeichert.");
    }

    setSymbol("");
  }

  async function removeSymbol(nextSymbol: string) {
    const parsed = normalizeSymbolInput(nextSymbol);
    if (!parsed.ok) {
      setInputError(parsed.message);
      return;
    }

    const normalizedSymbol = parsed.symbol;
    setHasUserWatchlistOverride(true);
    setDeletedLocalSymbols((current) => new Set(current).add(normalizedSymbol));
    setCloudItems((current) => current.filter((item) => item.symbol.toUpperCase() !== normalizedSymbol));
    setOfflineItems((current) => current.filter((item) => item.asset.symbol.toUpperCase() !== normalizedSymbol));

    try {
      const response = await fetchWithSupabaseAuth("/api/watchlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
          body: JSON.stringify({ symbol: normalizedSymbol, assetType: "stock" })
      });
      if (!response.ok) throw new Error("watchlist delete not authenticated");
      const data = await response.json() as { mode?: string };
      setSyncMode(data.mode === "supabase" ? "supabase" : "local");
      setSyncStatus(data.mode === "supabase" ? "Symbol aus Supabase entfernt." : "Symbol lokal entfernt.");
    } catch {
      setSyncMode("local");
      setSyncStatus("Supabase nicht erreichbar. Symbol lokal entfernt.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-stroke bg-panel/72 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-mist">Cloud-Watchlist</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Bei aktivem Supabase-Login werden Symbole in deiner Cloud-Watchlist gespeichert.
              Ohne Login bleibt alles klar als lokaler Demo-/Offline-Modus markiert.
            </p>
            <p className={`mt-2 rounded-xl border px-3 py-2 text-xs ${syncMode === "supabase" ? "border-profit/30 bg-profit/10 text-profit" : "border-amber/30 bg-amber/10 text-amber"}`}>
              {syncStatus}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.slice(0, MAX_SYMBOL_INPUT_CHARS))}
              className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
              aria-label="Symbol zur Watchlist hinzufügen"
            />
            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AssetType)}
              className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
              aria-label="Assetklasse"
            >
              <option value="stock">Aktie</option>
              <option value="etf">ETF</option>
              <option value="crypto">Krypto</option>
              <option value="forex">Forex</option>
              <option value="index">Index</option>
            </select>
            <button type="button" onClick={addSymbol} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-profit px-4 font-semibold text-ink">
              <Plus className="h-4 w-4" />
              Hinzufügen
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="text-xs text-muted">Refresh-Intervall mit Rate-Limit-Schutz</span>
            <select
              value={refreshInterval}
              onChange={(event) => setRefreshInterval(Number(event.target.value) as typeof refreshInterval)}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            >
              {refreshIntervals.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">
            UI-Updates werden gebündelt; große Listen werden auf 200 sichtbare Zeilen begrenzt.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-stroke bg-coal px-3 py-2">
          <ConnectionBadge status={stream.connectionStatus} mode={stream.refreshMode} intervalMs={stream.intervalMs} />
          <p className="text-xs leading-5 text-muted">
            Live-Quotes für sichtbare Watchlist-Symbole. Bei Rate-Limits wird automatisch langsamer gepollt oder Cache genutzt.
          </p>
          {stream.error ? <p className="text-xs text-amber">{stream.error}</p> : null}
        </div>
        {inputError ? <p className="mt-3 rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">{inputError}</p> : null}

        {cloudItems.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {cloudItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => removeSymbol(item.symbol)}
                className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted transition hover:border-loss/40 hover:text-loss"
              >
                {item.symbol}
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {visibleItems.length > 200 ? (
        <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
          {visibleItems.length} Einträge geladen. Aus Performance-Gründen werden die ersten 200 Einträge angezeigt.
        </p>
      ) : null}
      <WatchlistTable items={visibleItems.slice(0, 200)} liveQuotes={stream.quotes} />
    </section>
  );
}
