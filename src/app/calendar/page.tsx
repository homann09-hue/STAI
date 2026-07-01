import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Kalender | StockPilot AI",
  description: "Earnings, Dividenden, Splits, Makro- und Zentralbanktermine vorbereitet."
};

export default function CalendarPage() {
  return (
    <TerminalSectionView
      eyebrow="Kalender"
      title="Earnings, Dividenden, Splits und Makro-Termine"
      description="Kalenderdaten sind provider- und lizenzabhängig. STAI zeigt nach Anbieteranbindung Quelle, Zeit, Relevanz, betroffene Symbole und KI-Auswirkung."
      cards={[
        { title: "Earnings", text: "Quartalszahlen, Guidance und Analystenreaktionen werden als Event-Typen vorbereitet.", badge: "Provider" },
        { title: "Dividenden & Splits", text: "Ex-Date, Pay-Date, Ausschüttung und Splits lassen sich über Fundamentals-/Events-Provider anbinden." },
        { title: "Makro", text: "Fed, EZB, Inflation, Zinsen und Arbeitsmarktdaten werden für Risiko- und Marktregime-Analysen vorbereitet." }
      ]}
    />
  );
}
