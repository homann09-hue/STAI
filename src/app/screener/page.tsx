import type { Metadata } from "next";
import { MarketUniverseExplorer } from "@/components/market-universe-explorer";
import { TerminalSectionView } from "@/components/terminal-section-view";
import { getMarketUniverseProvider } from "@/lib/market-universe";

export const metadata: Metadata = {
  title: "Screener | StockPilot AI",
  description: "Screener für Aktien, ETFs, Krypto und Indizes mit Filtern, Sortierung und sichtbarer Datenqualität."
};

export default async function ScreenerPage() {
  const provider = getMarketUniverseProvider();
  const universe = await provider.search({ limit: 200 });

  return (
    <div className="space-y-5">
      <TerminalSectionView
        eyebrow="Screener"
        title="Ein Screener für Aktien, ETFs, Krypto, Indizes und weitere Börseninstrumente"
        description="STAI wird als globales Marktuniversum aufgebaut: Suche, Filter, Providerstatus und Datenqualität sind getrennt von echter Realtime-Lizenzierung."
        ctaHref="/stocks"
        ctaLabel="Aktien-Screener öffnen"
        cards={[
          { title: "Filter", text: "Assetklasse, Land, Branche, Marktkapitalisierung, Volumen, Performance, Dividende, KGV, Volatilität, Risiko und Datenanbieter.", badge: "Live-ready" },
          { title: "Volluniversum", text: "Nicht alle Instrumente liegen lokal im Client. Nach Anbieteranbindung werden Provider-Suchendpunkte serverseitig angebunden." },
          { title: "Keine Fake-Abdeckung", text: "Lizenzpflichtige Börsen, Indizes, Optionen und Futures werden klar als vorbereitet oder lizenzpflichtig markiert.", badge: "Trust" }
        ]}
      />
      <MarketUniverseExplorer instruments={universe.instruments} coverage={universe.coverage} />
    </div>
  );
}
