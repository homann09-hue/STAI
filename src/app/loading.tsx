export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">StockPilot AI lädt Daten und prüft Datenqualität.</span>
      <div className="h-36 animate-pulse rounded-md border border-stroke bg-panel" aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-md border border-stroke bg-panel" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
