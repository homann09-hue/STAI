import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News-Terminal | StockPilot AI",
  description:
    "News-Terminal mit Quellenstatus, Zeitstempel, Datenqualität und modellbasierter Relevanzbewertung für Markt-, Makro- und Unternehmensereignisse."
};

export default async function NewsTerminalPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="news" />;
}
