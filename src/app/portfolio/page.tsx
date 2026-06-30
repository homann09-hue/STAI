import { PortfolioView } from "@/components/portfolio-view";
import { getMockPortfolio } from "@/lib/mock/market";

export const metadata = {
  title: "Portfolio",
  description:
    "Portfolio-Analyse mit Gesamtwert, Gewinn und Verlust, Gewichtung, Asset Allocation, Risiko-Score und Szenario-Struktur.",
  robots: {
    index: false,
    follow: false
  }
};

export default function PortfolioPage() {
  return <PortfolioView initialPortfolio={getMockPortfolio()} />;
}
