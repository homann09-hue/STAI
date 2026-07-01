import type { Metadata } from "next";
import { BacktestingLab } from "@/components/backtesting-lab";

export const metadata: Metadata = {
  title: "Backtesting | StockPilot AI",
  description: "Backtesting, Drawdown, Rendite/Risiko und Szenarioanalyse vorbereitet."
};

export default function BacktestingPage() {
  return <BacktestingLab />;
}
