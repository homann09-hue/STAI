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
        description="Suche über das vorbereitete Marktuniversum mit sichtbarer Datenabdeckung. Was ein Filter tut, steht an ihm dran — auch dann, wenn er weniger tut, als sein Name vermuten ließe."
        ctaHref="/stocks"
        ctaLabel="Aktien-Screener öffnen"
        cards={[
          // Hier stand eine Liste aus elf Filtern -- Marktkapitalisierung,
          // Volumen, Performance, Dividende, KGV, Volatilitaet, Risiko. Keiner
          // davon existiert. Gefiltert wird nach Assetklasse, Abdeckung und
          // Text. Nach §90 war die Karte eine Zusage, die das Produkt nicht
          // einloest -- und auf einer Seite, die im Pro-Tarif verkauft wird,
          // ist das mehr als ein Schoenheitsfehler.
          { title: "Filter", text: "Assetklasse, Datenabdeckung, Anbieterstatus und Freitextsuche über Symbol, Name, Börse, Land und Kennungen (ISIN, WKN).", badge: "Verfügbar" },
          { title: "Noch nicht da", text: "Filter nach Marktkapitalisierung, KGV, Dividende, Volumen und Volatilität setzen Kennzahlen je Instrument voraus. Der Anbietertarif deckt sie für ein Universum dieser Größe nicht ab.", badge: "Offen" },
          { title: "Volluniversum", text: "Nicht alle Instrumente liegen lokal im Client. Nach Anbieteranbindung werden Provider-Suchendpunkte serverseitig angebunden." },
          { title: "Keine Fake-Abdeckung", text: "Lizenzpflichtige Börsen, Indizes, Optionen und Futures werden klar als vorbereitet oder lizenzpflichtig markiert.", badge: "Trust" }
        ]}
      />
      <MarketUniverseExplorer
        instruments={universe.instruments}
        coverage={universe.coverage}
        provider={universe.provider}
        disclaimer={universe.disclaimer}
      />
    </div>
  );
}
