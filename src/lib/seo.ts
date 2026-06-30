import { siteUrlFromEnv } from "@/lib/env";

export const siteConfig = {
  name: "StockPilot AI",
  shortName: "STAI",
  description:
    "Professionelle Investment-Analyse-App für Aktien, ETFs, Krypto, Indizes und Portfolio-Risiko mit Datenqualität, Watchlists, Charts und KI-Einschaetzungen.",
  url: siteUrlFromEnv(),
  locale: "de_DE",
  creator: "StockPilot AI",
  keywords: [
    "Aktienanalyse",
    "ETF Analyse",
    "Krypto Analyse",
    "Portfolio Analyse",
    "Investment Dashboard",
    "Finanzterminal",
    "Marktdaten",
    "KI Aktienanalyse",
    "Watchlist",
    "Risikoanalyse"
  ]
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
