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

function placeholderSummary(item: WatchlistItem): AssetSummary {
  const symbol = item.symbol.toUpperCase();
  const assetType = item.asset_type ?? item.assetType ?? "stock";
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

  const visibleItems = useMemo(() => {
    if (cloudItems.length) {
      return cloudItems.map((item) => {
        const normalized = item.symbol.toUpperCase();
        return initialItems.find((summary) => summary.asset.symbol === normalized) ?? placeholderSummary(item);
      });
    }

    if (offlineItems.length) return offlineItems;
    return initialItems;
  }, [cloudItems, initialItems, offlineItems]);
  const visibleSymbols = useMemo(
    () => [...new Set(visibleItems.slice(0, 30).map((item) => item.asset.symbol))],
    [visibleItems]
  );
  const stream = useMarketStream(visibleSymbols, visibleSymbols.length > 0, refreshInterval);

  useEffect(() => {
    if (!offlineReady) return;
    saveOfflineValue(OFFLINE_KEYS.watchlist, visibleItems);
  }, [offlineReady, visibleItems]);

  useEffect(() => {
    let cancelled = false;
    const stored = readOfflineValue<AssetSummary[]>(OFFLINE_KEYS.watchlist);

    if (stored?.length) {
      setOfflineItems(stored);
      if (!navigator.onLine) setSyncStatus("Offline-Watchlist aus lokalem Speicher geladen.");
    }
    setOfflineReady(true);

    fetchWithSupabaseAuth("/api/watchlist")
      .then((response) => response.json())
      .then((data: { items?: WatchlistItem[]; mode?: string }) => {
        if (cancelled) return;
        if (data.mode === "supabase") {
          setCloudItems(data.items ?? []);
          setSyncMode("supabase");
          setSyncStatus("Supabase-Cloud-Sync aktiv. Watchlist wird nutzerbezogen gespeichert.");
          return;
        }

        setCloudItems([]);
        setSyncMode("local");
        setSyncStatus("Kein Supabase-Login. Lokaler Demo-/Offline-Modus aktiv.");
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = readOfflineValue<AssetSummary[]>(OFFLINE_KEYS.watchlist);
          if (fallback?.length) setOfflineItems(fallback);
          setSyncMode("local");
          setSyncStatus(fallback?.length ? "Offline-Watchlist aus lokalem Speicher geladen." : "Supabase nicht erreichbar. Lokale Demo-Watchlist aktiv.");
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
      setCloudItems((current) => [data.item ?? { symbol: normalizedSymbol, assetType }, ...current.filter((item) => item.symbol !== normalizedSymbol)]);
      setSyncMode(data.mode === "supabase" ? "supabase" : "local");
      setSyncStatus(data.mode === "supabase" ? "Symbol in Supabase gespeichert." : "Symbol lokal gespeichert. Cloud-Sync nicht aktiv.");
    } catch {
      setCloudItems((current) => [{ symbol: normalizedSymbol, assetType }, ...current.filter((item) => item.symbol !== normalizedSymbol)]);
      setSyncMode("local");
      setSyncStatus("Nicht eingeloggt oder Supabase nicht erreichbar. Symbol lokal gespeichert.");
    }

    setSymbol("");
  }

  async function removeSymbol(nextSymbol: string) {
    setCloudItems((current) => current.filter((item) => item.symbol !== nextSymbol));

    try {
      const response = await fetchWithSupabaseAuth("/api/watchlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: nextSymbol, assetType: "stock" })
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
              onChange={(event) => setSymbol(event.target.value)}
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
