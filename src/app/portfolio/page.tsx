import { PortfolioView } from "@/components/portfolio-view";
import { getMockPortfolio } from "@/lib/mock/market";

export const metadata = {
  title: "Portfolio"
};

export default function PortfolioPage() {
  return <PortfolioView initialPortfolio={getMockPortfolio()} />;
}
