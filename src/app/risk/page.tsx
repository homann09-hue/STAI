import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risiko-Dashboard | StockPilot AI",
  description: "Portfolio-Risiko, Volatilität, Drawdown, Korrelationen, Klumpenrisiko und Szenarien."
};

/**
 * Wie `/markets`: der Bericht kommt über die tarifgeprüfte Route, nicht aus der
 * Server-Komponente.
 */
export default function RiskPage() {
  return <EntitledProfessionalView mode="risk" />;
}
