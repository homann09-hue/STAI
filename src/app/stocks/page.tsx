import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aktien-Screener | StockPilot AI",
  description:
    "Aktien-Screener mit Kursdaten, Fundamentaldaten, Providerstatus, Earnings-/Analystenfeldern falls verfügbar und sichtbarer Datenqualität."
};

export default async function StocksPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="stocks" />;
}
