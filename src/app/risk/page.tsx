import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risiko-Dashboard | StockPilot AI",
  description: "Portfolio-Risiko, Volatilitaet, Drawdown, Korrelationen, Klumpenrisiko und Szenarien."
};

export default async function RiskPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="risk" />;
}
