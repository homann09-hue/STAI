"use client";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="max-w-md rounded-md border border-stroke bg-panel p-6 text-center">
        <p className="text-sm text-loss">Fehler</p>
        <h1 className="mt-2 text-2xl font-semibold">Analyse konnte nicht geladen werden</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Es wurde keine sensible Fehlermeldung angezeigt. Bitte erneut versuchen oder Datenquelle pruefen.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-11 rounded-md bg-profit px-5 font-semibold text-ink"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
