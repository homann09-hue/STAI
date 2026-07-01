import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";
import { WatchlistSyncView } from "@/components/watchlist-sync-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchlist | StockPilot AI",
  description: "Watchlist mit Kursen, Datenqualität, Provider, Last Updated und klarer Trennung von Live-, Delayed- und Mock-Daten.",
  robots: {
    index: false,
    follow: false
  }
};

export default async function WatchlistPage() {
  const data = await getMarketDataProvider().getDashboard();

  return (
    <div className="space-y-5">
      <TerminalSectionView
        eyebrow="Watchlist"
        title="Deine beobachteten Assets mit Provider-Transparenz"
        description="Die Watchlist zeigt Kurse nie ohne Datenqualität. Live/near-realtime, delayed, cached und mock bleiben sichtbar getrennt."
        cards={[
          { title: "Offline-fähig", text: "Dashboard-Watchlist wird lokal für PWA-Offline-Nutzung gespeichert." },
          { title: "Batching", text: "Sichtbare Assets werden zusammen aktualisiert, um Rate-Limits zu schonen.", badge: "10s" },
          { title: "Alerts", text: "Preis-, RSI-, News-, Volumen-, Earnings- und KI-Risikoalarme sind vorbereitet." }
        ]}
        ctaHref="/alerts"
        ctaLabel="Alerts verwalten"
      />
      <WatchlistSyncView initialItems={data.watchlist} />
    </div>
  );
}
