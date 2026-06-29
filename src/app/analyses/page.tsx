import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Analysen | StockPilot AI",
  description: "KI-Analysen, Chancen, Risiken, Szenarien und Datenqualitaet."
};

export default function AnalysesPage() {
  return (
    <TerminalSectionView
      eyebrow="Analysen"
      title="KI-Analysen mit Chancen, Risiken und Unsicherheiten"
      description="Analysen bleiben modellbasierte Einschaetzungen ohne Garantie. Datenqualitaet, Quellen und Unsicherheiten werden als eigener Bestandteil angezeigt."
      ctaHref="/assets/NVDA"
      ctaLabel="Beispielanalyse oeffnen"
      cards={[
        { title: "Kurzfazit", text: "Bull Case, Bear Case, Neutral Case und wichtigste Kurstreiber je Asset." },
        { title: "Risiko", text: "Unsicherheiten, Datenluecken, technische Risiken und Event-Risiken werden sichtbar getrennt.", badge: "Keine Beratung" },
        { title: "News-Auswirkung", text: "Nachrichten werden mit Relevanz, Sentiment und moeglicher Kursauswirkung eingeordnet." }
      ]}
    />
  );
}
