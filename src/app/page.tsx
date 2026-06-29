import { DashboardView } from "@/components/dashboard-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getMarketDataProvider().getDashboard();

  return <DashboardView data={data} />;
}
