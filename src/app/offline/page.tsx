import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline"
};

export default function OfflinePage() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="max-w-md rounded-md border border-stroke bg-panel p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-loss/30 bg-loss/10 text-loss">
          <WifiOff className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Offline-Modus</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Watchlist und zuletzt geoffnete Analysen bleiben lokal verfugbar. Sobald die Verbindung
          zuruck ist, aktualisiert StockPilot AI die Daten automatisch.
        </p>
      </div>
    </div>
  );
}
