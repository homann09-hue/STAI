import { DashboardView } from "@/components/dashboard-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const provider = getMarketDataProvider();
  const data = await provider.getDashboard();
  const heroSymbol = data.watchlist[0]?.asset.symbol ?? data.gainers[0]?.asset.symbol ?? "NVDA";
  const heroAsset = await provider.getAsset(heroSymbol);

  return <DashboardView data={data} heroAsset={heroAsset} />;
}
