import type { Metadata } from "next";
import { ProfessionalDataView } from "@/components/professional-data-view";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Krypto-Screener | StockPilot AI",
  description: "Krypto-Screener mit Near-Realtime-Preis, Bid/Ask, Spread, Volumen, Market Cap und vorbereiteten On-Chain-Daten."
};

export default async function CryptoPage() {
  const report = await getProfessionalDataProvider().getMarketReport();
  return <ProfessionalDataView report={report} mode="crypto" />;
}
