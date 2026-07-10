import { siteUrlFromEnv } from "@/lib/env";

export const siteConfig = {
  name: "StockPilot AI",
  shortName: "STAI",
  description:
    "Finanzanalyse-PWA für Aktien, ETFs, Krypto, Indizes und Portfolios mit sichtbarer Datenqualität, Risiko-Hinweisen, Watchlists, Charts und modellbasierten KI-Einschätzungen.",
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
    "modellbasierte Aktienanalyse",
    "Watchlist",
    "Risikoanalyse"
  ]
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
