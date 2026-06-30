import { BellRing, DatabaseZap, KeyRound, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { InvestorModeDock } from "@/components/investor-mode-dock";
import { SupabaseAuthPanel } from "@/components/supabase-auth-panel";
import { refreshIntervals, refreshProfiles } from "@/lib/refresh-config";

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

      <SupabaseAuthPanel />

      <InvestorModeDock />

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan/25 bg-cyan/10 text-cyan">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-mist">Refresh-Modus & Live-Verhalten</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              WebSocket/Streaming wird bevorzugt. Wenn der Anbieter nur REST erlaubt, nutzt STAI
              standardmäßig 10 Sekunden Near-Realtime-Polling, reduziert im Hintergrund die Last
              und reagiert auf Rate-Limits mit Backoff.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {refreshProfiles.map((profile) => (
            <article key={profile.key} className="rounded-2xl border border-stroke bg-coal/70 p-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-profit" />
                <p className="font-semibold text-mist">{profile.label}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{profile.description}</p>
              <p className="mt-2 font-mono text-sm text-cyan">
                {profile.intervalMs ? `${profile.intervalMs / 1000}s` : "manual"}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {refreshIntervals.map((item) => (
            <span key={item.value} className="rounded-full border border-stroke bg-coal px-3 py-2 text-xs text-muted" title={item.description}>
              {item.label}
            </span>
          ))}
        </div>
      </section>

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
