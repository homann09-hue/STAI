import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aktien-Screener | StockPilot AI",
  description:
    "Aktien-Screener mit Kursdaten, Fundamentaldaten, Providerstatus, Earnings-/Analystenfeldern falls verfügbar und sichtbarer Datenqualität."
};

/**
 * Der Marktbericht ist eine Bezahlleistung. Er wird deshalb nicht mehr in der
 * Server-Komponente geladen, weil er damit im ausgelieferten HTML gestanden
 * haette — auch fuer Besucher ohne Konto. Die Tarifpruefung sitzt jetzt in
 * `/api/professional/overview`.
 */
export default function StocksPage() {
  return <EntitledProfessionalView mode="stocks" />;
}
