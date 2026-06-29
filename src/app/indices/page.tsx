import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Indizes | StockPilot AI",
  description: "Globale Index-Uebersichten fuer DAX, S&P 500, Nasdaq, Dow Jones und MSCI-nahe Benchmarks."
};

export default function IndicesPage() {
  return (
    <TerminalSectionView
      eyebrow="Indizes"
      title="Globale Index-Uebersichten mit klarer Datenqualitaet"
      description="Indexfeeds sind als eigener Bereich vorbereitet. Sobald lizenzierte Indexdaten angebunden sind, erscheinen hier Kurse, Futures, Marktstatus, Heatmaps und Benchmark-Vergleiche."
      cards={[
        { title: "US-Indizes", text: "S&P 500, Nasdaq und Dow Jones als Watchlist-/Benchmark-Struktur vorbereitet.", badge: "Provider" },
        { title: "Europa", text: "DAX, SDAX, Euro Stoxx und weitere Indizes koennen ueber die Provider-Schicht normalisiert werden.", badge: "Lizenz" },
        { title: "Benchmarking", text: "Portfolio vs MSCI World, S&P 500 und Nasdaq ist als Vergleichslogik im Datenmodell vorbereitet." }
      ]}
    />
  );
}
