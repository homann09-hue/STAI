import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { withCacheFallback } from "@/lib/provider-cache";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finanzterminal für Aktien, ETFs, Krypto und Portfolio-Risiko",
  description:
    "StockPilot AI bündelt Watchlists, Marktübersichten, Charts, News, Datenqualität und KI-Einschätzungen in einer mobilen Investment-Analyse-App. Keine Anlageberatung.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "StockPilot AI - Modernes Finanzterminal",
    description:
      "Mobile-first Investment-Dashboard mit Marktdaten, Risiko-Hinweisen, Watchlists, Charts und KI-Analysen.",
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    title: "StockPilot AI - Investment-Analyse",
    description:
      "Aktien, ETFs, Krypto, Portfolio-Risiko und KI-Einschätzungen in einer professionellen PWA.",
    images: [absoluteUrl("/opengraph-image")]
  }
};

export default async function HomePage() {
  const provider = getMarketDataProvider();
  const result = await withCacheFallback("dashboard", () => provider.getDashboard(), {
    ttlMs: 10000,
    staleTtlMs: 120000
  });

  return <DashboardView data={result.value} heroAsset={null} />;
}
