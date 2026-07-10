import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="max-w-md rounded-md border border-stroke bg-panel p-6 text-center">
        <p className="text-sm text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Analyse nicht gefunden</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Für dieses Symbol liegen aktuell keine belastbaren Daten vor. Bitte prüfe Symbol, Schreibweise und Datenquelle.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-profit px-5 font-semibold text-ink"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
