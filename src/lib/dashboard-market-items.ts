import type { AssetSummary, DashboardData } from "@/lib/types";

type DashboardMarketLists = Pick<
  DashboardData,
  "watchlist" | "mostActive" | "trendingAssets" | "gainers" | "losers"
>;

/**
 * Baut die sichtbare Tickerleiste ausschließlich aus Daten auf, die der
 * Dashboard-Provider tatsächlich geliefert hat.
 *
 * Hier gibt es absichtlich keine statischen Indexwerte und keinen
 * Produktions-Fallback. Eine leere Liste ist ehrlicher als ein DAX-, S&P- oder
 * Bitcoin-Kurs, der nur im Frontend erfunden wurde.
 */
export function selectDashboardTickerItems(data: DashboardMarketLists, limit = 10): AssetSummary[] {
  const bySymbol = new Map<string, AssetSummary>();
  const ordered = [
    ...data.watchlist,
    ...data.mostActive,
    ...data.trendingAssets,
    ...data.gainers,
    ...data.losers
  ];

  for (const item of ordered) {
    const symbol = item.asset.symbol.trim().toUpperCase();
    if (!symbol || bySymbol.has(symbol)) continue;
    bySymbol.set(symbol, item);
  }

  return [...bySymbol.values()].slice(0, Math.min(Math.max(limit, 0), 100));
}
