import type { Metadata } from "next";
import { MarketUniverseExplorer } from "@/components/market-universe-explorer";
import { TerminalSectionView } from "@/components/terminal-section-view";
import { getMarketUniverse, marketUniverseCoverage } from "@/lib/market-universe";

export const metadata: Metadata = {
  title: "Screener | StockPilot AI",
  description: "Screener fuer Aktien, ETFs, Krypto und Indizes mit Filtern, Sortierung und Datenqualitaet."
};

export default function ScreenerPage() {
  const instruments = getMarketUniverse({ limit: 200 });

  return (
    <div className="space-y-5">
      <TerminalSectionView
        eyebrow="Screener"
        title="Ein Screener fuer Aktien, ETFs, Krypto, Indizes und weitere Boerseninstrumente"
        description="STAI wird als globales Marktuniversum aufgebaut: Suche, Filter, Providerstatus und Datenqualitaet sind getrennt von echter Realtime-Lizenzierung."
        ctaHref="/stocks"
        ctaLabel="Aktien-Screener oeffnen"
        cards={[
          { title: "Filter", text: "Assetklasse, Land, Branche, Marktkapitalisierung, Volumen, Performance, Dividende, KGV, Volatilitaet, Risiko und Datenanbieter.", badge: "Live-ready" },
          { title: "Volluniversum", text: "Nicht alle Instrumente liegen lokal im Client. Spaeter werden Provider-Suchendpunkte serverseitig angebunden." },
          { title: "Keine Fake-Abdeckung", text: "Lizenzpflichtige Boersen, Indizes, Optionen und Futures werden klar als vorbereitet oder lizenzpflichtig markiert.", badge: "Trust" }
        ]}
      />
      <MarketUniverseExplorer instruments={instruments} coverage={marketUniverseCoverage} />
    </div>
  );
}
