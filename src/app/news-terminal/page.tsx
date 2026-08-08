import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News-Terminal | StockPilot AI",
  description:
    "News-Terminal mit Quellenstatus, Zeitstempel, Datenqualität und modellbasierter Relevanzbewertung für Markt-, Makro- und Unternehmensereignisse."
};

/**
 * Der Marktbericht ist eine Bezahlleistung. Er wird deshalb nicht mehr in der
 * Server-Komponente geladen, weil er damit im ausgelieferten HTML gestanden
 * haette — auch fuer Besucher ohne Konto. Die Tarifpruefung sitzt jetzt in
 * `/api/professional/overview`.
 */
export default function NewsTerminalPage() {
  return <EntitledProfessionalView mode="news" />;
}
