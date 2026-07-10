import type { Metadata } from "next";
import { BacktestingLab } from "@/components/backtesting-lab";

export const metadata: Metadata = {
  title: "Backtesting | StockPilot AI",
  description: "Backtesting-Lab mit Demo-Szenarien, Drawdown, Rendite/Risiko und klar markierter Datenqualität."
};

export default function BacktestingPage() {
  return <BacktestingLab />;
}
