import type { Metadata } from "next";
import { AccountBillingView } from "@/components/account-billing-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abrechnung | StockPilot AI",
  description: "Tarif, Preis, nächste Abrechnung, Zahlungsstatus, Zahlungsmethode, Rechnungen und Kündigung."
};

/**
 * Der Bereich lädt seine Daten ausschließlich im Browser über tarifgeprüfte
 * Routen. Abrechnungsdaten dürfen nicht im serverseitig gerenderten HTML stehen.
 */
export default function AccountBillingPage() {
  return <AccountBillingView />;
}
