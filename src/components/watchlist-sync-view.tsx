"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WatchlistTable } from "@/components/market-boxes";
import { readOfflineValue, saveOfflineValue, OFFLINE_KEYS } from "@/lib/offline";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import type { AssetSummary, AssetType } from "@/lib/types";

type WatchlistItem = {
  id?: string;
  symbol: string;
  asset_type?: AssetType;
  assetType?: AssetType;
};

export function WatchlistSyncView({ initialItems }: { initialItems: AssetSummary[] }) {
  const [cloudItems, setCloudItems] = useState<WatchlistItem[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [offlineItems, setOfflineItems] = useState<AssetSummary[]>([]);
  const [offlineReady, setOfflineReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Lokale Provider-Watchlist aktiv.");

  const visibleItems = useMemo(() => {
    if (!cloudItems.length && offlineItems.length) return offlineItems;
    if (!cloudItems.length) return initialItems;
    const allowedSymbols = new Set(cloudItems.map((item) => item.symbol));
    const filtered = initialItems.filter((item) => allowedSymbols.has(item.asset.symbol));
    return filtered.length ? filtered : initialItems;
  }, [cloudItems, initialItems, offlineItems]);

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
        setCloudItems(data.items ?? []);
        setSyncStatus(data.mode === "supabase" ? "Supabase-Watchlist aktiv." : "Lokale Provider-Watchlist aktiv.");
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = readOfflineValue<AssetSummary[]>(OFFLINE_KEYS.watchlist);
          if (fallback?.length) setOfflineItems(fallback);
          setSyncStatus(fallback?.length ? "Offline-Watchlist aus lokalem Speicher geladen." : "Supabase nicht erreichbar. Lokale Watchlist aktiv.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function addSymbol() {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) return;

    try {
      const response = await fetchWithSupabaseAuth("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: normalizedSymbol, assetType })
      });
      const data = await response.json() as { item?: WatchlistItem; mode?: string };
      setCloudItems((current) => [data.item ?? { symbol: normalizedSymbol, assetType }, ...current.filter((item) => item.symbol !== normalizedSymbol)]);
      setSyncStatus(data.mode === "supabase" ? "Symbol in Supabase gespeichert." : "Symbol lokal vorgemerkt.");
    } catch {
      setCloudItems((current) => [{ symbol: normalizedSymbol, assetType }, ...current.filter((item) => item.symbol !== normalizedSymbol)]);
      setSyncStatus("Supabase nicht erreichbar. Symbol lokal vorgemerkt.");
    }
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
      const data = await response.json() as { mode?: string };
      setSyncStatus(data.mode === "supabase" ? "Symbol aus Supabase entfernt." : "Symbol lokal entfernt.");
    } catch {
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
              Bei aktivem Supabase-Login werden Symbole in deiner Cloud-Watchlist gespeichert. Ohne Login bleibt die lokale Provider-Watchlist sichtbar.
            </p>
            <p className="mt-2 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">{syncStatus}</p>
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

      <WatchlistTable items={visibleItems} liveQuotes={{}} />
    </section>
  );
}
