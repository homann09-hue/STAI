import type { Metadata } from "next";
import { TerminalSectionView } from "@/components/terminal-section-view";

export const metadata: Metadata = {
  title: "Screener | StockPilot AI",
  description: "Screener fuer Aktien, ETFs, Krypto und Indizes mit Filtern, Sortierung und Datenqualitaet."
};

export default function ScreenerPage() {
  return (
    <TerminalSectionView
      eyebrow="Screener"
      title="Ein Screener fuer Aktien, ETFs, Krypto und Indizes"
      description="Die spezialisierten Screener sind bereits unter Aktien, ETFs und Krypto erreichbar. Diese Workbench buendelt Filter, gespeicherte Sichten und Live/Near-Realtime-Qualitaet."
      ctaHref="/stocks"
      ctaLabel="Aktien-Screener oeffnen"
      cards={[
        { title: "Filter", text: "Assetklasse, Land, Branche, Marktkapitalisierung, Volumen, Performance, Dividende, KGV, Volatilitaet, Risiko und Datenanbieter.", badge: "Live-ready" },
        { title: "Sortierung", text: "Tabellen sind fuer sortierbare Spalten und mobile Nutzung vorbereitet." },
        { title: "Gespeicherte Filter", text: "Persistenz ueber Supabase/Userdaten ist vorbereitet, wird aber ohne Backend nicht hart erzwungen.", badge: "Supabase" }
      ]}
    />
  );
}
