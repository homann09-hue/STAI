import type { Metadata } from "next";
import { EntitledProfessionalView } from "@/components/entitled-professional-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Krypto-Screener | StockPilot AI",
  description:
    "Krypto-Screener mit Providerstatus für Preise, Bid/Ask, Spread, Volumen, Market Cap und klar markierten vorbereiteten On-Chain-Feldern."
};

/**
 * Der Marktbericht ist eine Bezahlleistung. Er wird deshalb nicht mehr in der
 * Server-Komponente geladen, weil er damit im ausgelieferten HTML gestanden
 * haette — auch fuer Besucher ohne Konto. Die Tarifpruefung sitzt jetzt in
 * `/api/professional/overview`.
 */
export default function CryptoPage() {
  return <EntitledProfessionalView mode="crypto" />;
}
