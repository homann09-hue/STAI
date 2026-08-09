import { AdminAccountsPanel } from "@/components/admin-accounts-view";

export const metadata = {
  title: "Verwaltung",
  description: "Konten, Abos und Freischaltungen.",
  robots: {
    index: false,
    follow: false
  }
};

/**
 * Der Adminbereich.
 *
 * Die Seite selbst prüft nichts. Der Schutz sitzt in den Routen, die sie
 * aufruft — `requireAdmin` liest die Rolle serverseitig aus der Datenbank.
 * Eine Seite, die nur die Navigation versteckt, wäre keine Absicherung: wer
 * die Adresse kennt, ruft sie trotzdem auf.
 *
 * Wer hier ohne Rechte landet, sieht deshalb eine leere Ansicht mit der
 * Fehlermeldung der Route — und nicht etwa fremde Kontodaten.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Verwaltung</h1>
        <p className="text-sm text-muted-foreground">
          Betriebszahlen und Kontoverwaltung. Sichtbar nur für Konten mit Adminrecht in der Datenbank.
        </p>
      </header>

      <AdminAccountsPanel />
    </main>
  );
}
