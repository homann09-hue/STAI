import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ETF-Screener | StockPilot AI",
  description:
    "ETF-Screener mit Kosten-, AUM-, Holdings-, Risiko- und Benchmark-Feldern, klar getrennt nach echten, gecachten, vorbereiteten und Demo-Daten."
};

/**
 * Der Marktbericht ist eine Bezahlleistung. Er wird deshalb nicht mehr in der
 * Server-Komponente geladen, weil er damit im ausgelieferten HTML gestanden
 * haette — auch fuer Besucher ohne Konto. Die Tarifpruefung sitzt jetzt in
 * `/api/professional/overview`.
 */
export default function EtfsPage() {
  return <EntitledProfessionalView mode="etfs" />;
}
