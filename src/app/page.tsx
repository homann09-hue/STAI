import { DashboardView } from "@/components/dashboard-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";

export default async function HomePage() {
  const data = await getMarketDataProvider().getDashboard();

  return <DashboardView data={data} />;
}
