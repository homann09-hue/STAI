import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Market Overview | StockPilot AI",
  description:
    "Marktübersicht mit Kursqualität, Screenern, Portfolio-Risiko, transparenten Datenquellen und sichtbarer Trennung von Live-, Cache- und Demo-Daten."
};

export default async function MarketsPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="overview" />;
}
