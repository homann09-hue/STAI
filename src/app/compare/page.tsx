import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vergleich | StockPilot AI",
  description: "Vergleiche für Asset vs Benchmark, ETF vs ETF, Aktie vs Branche und Portfolio vs Index."
};

/**
 * Der Marktbericht ist eine Bezahlleistung. Er wird deshalb nicht mehr in der
 * Server-Komponente geladen, weil er damit im ausgelieferten HTML gestanden
 * haette — auch fuer Besucher ohne Konto. Die Tarifpruefung sitzt jetzt in
 * `/api/professional/overview`.
 */
export default function ComparePage() {
  return <EntitledProfessionalView mode="compare" />;
}
