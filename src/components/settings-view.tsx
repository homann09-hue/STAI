import { BellRing, DatabaseZap, KeyRound, ShieldCheck } from "lucide-react";
import { InvestorModeDock } from "@/components/investor-mode-dock";

const settingsCards = [
  {
    title: "Daten & Transparenz",
    text: "Mock-, Delay- und Live-Daten werden getrennt gekennzeichnet, damit keine Demo-Daten wie echte Marktpreise wirken.",
    icon: DatabaseZap
  },
  {
    title: "Sicherheit",
    text: "API-Keys gehören serverseitig in Umgebungsvariablen. Supabase Auth und RLS sind vorbereitet.",
    icon: KeyRound
  },
  {
    title: "Risiko-Hinweise",
    text: "Alle Analysen bleiben algorithmische Einschätzungen ohne Garantie und ohne Anlageberatung.",
    icon: ShieldCheck
  },
  {
    title: "Benachrichtigungen",
    text: "Preis-, RSI-, News-, Volumen-, Earnings- und KI-Risikoalarme sind als Produktstruktur vorbereitet.",
    icon: BellRing
  }
];

export function SettingsView() {
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(39,224,183,0.18),transparent_34%),linear-gradient(145deg,rgba(12,19,32,0.98),rgba(5,8,14,0.98))] p-5 shadow-panel sm:p-7">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-profit">
            Einstellungen
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-mist sm:text-4xl">
            Personalisierung, Vertrauen und App-Steuerung
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Hier stellst du ein, wie StockPilot AI dich begleitet: einfache Erklärungen für den
            Einstieg, mehr Kennzahlen für Fortgeschrittene oder ein tieferes Terminal-Setup für
            professionelle Analysen.
          </p>
        </div>
      </section>

      <InvestorModeDock />

      <section className="grid gap-3 md:grid-cols-2">
        {settingsCards.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.title} className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-profit/25 bg-profit/10 text-profit">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-mist">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
