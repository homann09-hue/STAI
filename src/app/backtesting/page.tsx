import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Backtesting | StockPilot AI",
  description: "Backtesting, Drawdown, Rendite/Risiko und Szenarioanalyse vorbereitet."
};

export default function BacktestingPage() {
  return (
    <TerminalSectionView
      eyebrow="Backtesting"
      title="Strategien testen, bevor sie ins Portfolio gehen"
      description="Backtesting benoetigt saubere historische Daten. STAI bereitet Drawdown, Volatilitaet, Rendite/Risiko, Korrelationen und Benchmark-Vergleich vor."
      cards={[
        { title: "Historische Daten", text: "Provider wie Polygon/Massive, Databento, EODHD oder Twelve Data koennen spaeter die Candle-Historie liefern.", badge: "Lizenz" },
        { title: "Kennzahlen", text: "Max Drawdown, Sharpe Ratio, Volatilitaet, Trefferquote und Benchmark-Abweichung." },
        { title: "Szenarien", text: "Portfolio-Schocks, Rebalancing und Konzentrationsrisiken sind als Analytics-Struktur vorbereitet." }
      ]}
    />
  );
}
