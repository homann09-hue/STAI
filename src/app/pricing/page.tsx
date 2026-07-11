import { PricingView } from "@/components/pricing-view";

export const metadata = {
  title: "Preise",
  description:
    "Preisstruktur für StockPilot AI: Free, Starter, Pro und Elite/Business mit Watchlists, Analysen, Alerts, Portfolio und Profi-Dashboards."
};

export default function PricingPage() {
  return (
    <>
      <PricingView />
      <aside
        aria-label="Technischer Tarifstatus"
        className="mx-auto mb-8 mt-4 max-w-7xl rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
      >
        <strong className="text-slate-100">Feature-Gates vorbereitet und serverseitig abgesichert.</strong>{" "}
        Der Pro-Tarif unterstützt mehrere Portfolios, sobald ein verifiziertes Abo aktiv ist.
      </aside>
    </>
  );
}
