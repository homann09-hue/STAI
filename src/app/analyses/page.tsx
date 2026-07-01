import type { Metadata } from "next";
import { AnalysisWorkbench } from "@/components/analysis-workbench";

export const metadata: Metadata = {
  title: "Analysen | StockPilot AI",
  description: "KI-Analysen mit Chancen, Risiken, Szenarien, Unsicherheiten und transparenter Datenqualität."
};

export default function AnalysesPage() {
  return <AnalysisWorkbench />;
}
