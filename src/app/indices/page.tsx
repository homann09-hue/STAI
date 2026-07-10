import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Indizes | StockPilot AI",
  description: "Globale Index-Übersichten für DAX, S&P 500, Nasdaq, Dow Jones und MSCI-nahe Benchmarks."
};

export default function IndicesPage() {
  return (
    <TerminalSectionView
      eyebrow="Indizes"
      title="Globale Index-Übersichten mit klarer Datenqualität"
      description="Diese Ansicht bündelt Index-Benchmarks, Datenstatus und Vergleichslogik. Lizenzpflichtige Realtime-Indexfeeds werden nicht simuliert und fehlende Daten bleiben sichtbar markiert."
      cards={[
        { title: "US-Indizes", text: "S&P 500, Nasdaq und Dow Jones werden als Benchmark-Struktur mit sichtbarem Provider- und Qualitätsstatus geführt.", badge: "Status" },
        { title: "Europa", text: "DAX, SDAX, Euro Stoxx und weitere Indizes laufen über die normalisierte Provider-Schicht, wenn lizenzierte Daten verfügbar sind.", badge: "Lizenz" },
        { title: "Benchmarking", text: "Portfolio-Vergleiche gegen MSCI World, S&P 500 und Nasdaq bleiben als Analysemodell klar von echten Indexfeeds getrennt." }
      ]}
    />
  );
}
