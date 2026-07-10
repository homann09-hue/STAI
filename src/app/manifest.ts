import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockPilot AI",
    short_name: "StockPilot",
    description:
      "Mobile-first PWA für Aktien-, ETF- und Krypto-Analyse mit Datenqualitätsstatus, Risiko-Hinweisen, Watchlists, Alerts und Portfolio-Übersicht.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050706",
    theme_color: "#050706",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
