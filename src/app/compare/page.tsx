import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vergleich | StockPilot AI",
  description: "Vergleiche für Asset vs Benchmark, ETF vs ETF, Aktie vs Branche und Portfolio vs Index."
};

export default async function ComparePage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="compare" />;
}
