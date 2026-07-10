import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline",
  description: "Offline-Modus der StockPilot AI PWA mit gespeicherter Watchlist und letzten Analysen.",
  robots: {
    index: false,
    follow: false
  }
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
          Watchlist und zuletzt gespeicherte Ansichten bleiben lokal verfügbar. Neue Marktdaten,
          News und KI-Analysen brauchen eine Verbindung und werden nach Rückkehr online neu geprüft.
        </p>
      </div>
    </div>
  );
}
