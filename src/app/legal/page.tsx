import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutz und rechtliche Hinweise | StockPilot AI",
  description: "Technische Datenschutz-, Datenquellen- und Risikohinweise für StockPilot AI."
};

const sections = [
  {
    title: "Keine Anlageberatung",
    text: "StockPilot AI stellt Daten, Rechenmodelle und algorithmische Einschätzungen bereit. Ergebnisse können unvollständig, verzögert oder falsch sein und sind keine individuelle Anlage-, Rechts- oder Steuerberatung."
  },
  {
    title: "Datenqualität und Quellen",
    text: "Jede Marktdatenanzeige muss Realtime, Near-Realtime, Delayed, Cached, Historical, Mock oder Unavailable kennzeichnen. Nutzungs-, Anzeige- und Weitergaberechte hängen vom jeweiligen Providervertrag ab."
  },
  {
    title: "Personenbezogene Daten",
    text: "Bei Anmeldung verarbeitet Supabase insbesondere E-Mail, Profil, Watchlists, Alerts und Portfoliodaten. Nutzer können ihre Cloud-Daten in den Einstellungen exportieren und ihr Konto einschließlich zugehöriger Cloud-Daten löschen. Lokale Offline-Daten werden bei der Kontolöschung auf diesem Gerät ebenfalls entfernt."
  },
  {
    title: "Cookies und lokale Speicherung",
    text: "Die App verwendet technisch erforderliche Supabase-Sessiondaten sowie lokale Speicherung für Offline-Funktionen, Einstellungen und Risikohinweise. Ein Marketing- oder Werbetracking ist im geprüften Quellcode nicht integriert."
  },
  {
    title: "Impressum und Verantwortlicher",
    text: "Vor einem öffentlichen kommerziellen Betrieb müssen vollständige Betreiberangaben, ladungsfähige Anschrift, Kontakt, Datenschutzverantwortlicher und gegebenenfalls Aufsichtsangaben durch den Betreiber ergänzt und juristisch geprüft werden."
  },
  {
    title: "Technischer Compliance-Status",
    text: "Diese Seite dokumentiert technische Schutzmaßnahmen und offene organisatorische Pflichten. Sie ersetzt keine Prüfung durch Datenschutz-, Kapitalmarkt- oder Medienrechtsfachleute."
  }
];

export default function LegalPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-stroke bg-panel/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan">Transparenz</p>
        <h1 className="mt-3 text-3xl font-semibold text-mist sm:text-4xl">Datenschutz und rechtliche Hinweise</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Stand: 10. Juli 2026. Technische Compliance-Prüfung, keine verbindliche Rechtsberatung.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-stroke bg-coal/75 p-5">
            <h2 className="font-semibold text-mist">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{section.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
