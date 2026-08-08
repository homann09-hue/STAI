import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";
import { getPublicProviderCapabilityReport } from "@/lib/provider-health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Market Overview | StockPilot AI",
  description:
    "Marktübersicht mit Kursqualität, Screenern, Portfolio-Risiko, transparenten Datenquellen und sichtbarer Trennung von Live-, Cache- und Demo-Daten."
};

/**
 * Der Marktbericht ist eine Bezahlleistung und wird deshalb nicht mehr hier
 * geladen. Serverseitiges Rendern hätte ihn ins ausgelieferte HTML geschrieben —
 * für jeden Besucher, auch ohne Konto.
 *
 * Der Providerstatus bleibt öffentlich: er sagt etwas über den Betrieb der
 * Plattform, nicht über einen Markt.
 */
export default async function MarketsPage() {
  const providerCapabilities = await getPublicProviderCapabilityReport();

  return <EntitledProfessionalView mode="overview" providerCapabilities={providerCapabilities} />;
}
