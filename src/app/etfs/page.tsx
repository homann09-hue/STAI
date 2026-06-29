import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ETF-Screener | StockPilot AI",
  description: "ETF-Daten zu Kosten, AUM, Holdings, Sektoren, Laendern, Risiko und Benchmark."
};

export default async function EtfsPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="etfs" />;
}
