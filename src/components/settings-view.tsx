import { BellRing, CheckCircle2, DatabaseZap, KeyRound, RefreshCw, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";
import { FunctionAssurancePanel } from "@/components/function-assurance-panel";
import { InvestorModeDock } from "@/components/investor-mode-dock";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { ProviderHealthCenter } from "@/components/provider-health-center";
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
    text: "API-Keys gehören serverseitig in geschützte Konfiguration. Auth und strikte Nutzertrennung sind vorbereitet.",
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

const productionChecklist = [
  "Datenqualität muss bei jedem Kurs, jeder News und jeder Analyse sichtbar bleiben.",
  "Mock- oder Demo-Daten dürfen keine echten Kauf-/Verkaufssignale erzeugen.",
  "API-Keys bleiben serverseitig; clientseitige Konfiguration enthält nur wirklich öffentliche Werte.",
  "Cloud-Sync gilt erst als aktiv, wenn eine echte Session bestätigt ist.",
  "Polling/Streaming muss Rate-Limits respektieren und bei Fehlern verständliche Fallbacks zeigen.",
  "Offline-Daten sind Komfortfunktionen und müssen klar von Live-Daten getrennt bleiben."
];

const dataSourcePolicy = [
  ["Realtime", "Nur anzeigen, wenn ein Provider wirklich Live-/WebSocket-Daten liefert und die Lizenz das erlaubt."],
  ["Near-Realtime", "Für kostenlose oder günstige APIs mit kurzer Verzögerung, Polling und Rate-Limit-Schutz."],
  ["Delayed", "Für Börsendaten mit typischer 15-Minuten-Verzögerung oder Provider-Vorgaben."],
  ["Cached", "Für gespeicherte Antworten mit TTL, damit Rate-Limits und Kosten kontrolliert bleiben."],
  ["Mock", "Nur Demo-/Fallback-Daten. Nie als echte Kurse, echte News oder echte Signale verkaufen."],
  ["Unavailable", "Wenn API-Key, Lizenz, Provider oder Netzwerk fehlt, lieber ehrlich leer anzeigen als Daten erfinden."]
];

const liveReadinessChecks = [
  {
    label: "Serverseitige API-Keys",
    status: "ready",
    text: "Code-Readiness: Provider-Schicht nutzt Server-Routen. Echte Keys und Anbieterrechte müssen in Vercel/Backend geprüft werden."
  },
  {
    label: "Datenqualitäts-Badges",
    status: "ready",
    text: "UI-Readiness: Realtime, Near-Realtime, Delayed, Mock und Unavailable werden sichtbar unterschieden."
  },
  {
    label: "Billing-Gates",
    status: "partial",
    text: "Feature-Matrix ist vorbereitet, echte Entitlements müssen serverseitig angebunden werden."
  },
  {
    label: "Professionelle Börsenlizenzen",
    status: "blocked",
    text: "Nicht freigeschaltet: Bid/Ask, Level-2, Insider- und institutionelle Daten brauchen je nach Markt kostenpflichtige Lizenzen."
  }
];

const operationalRoadmap = [
  ["1", "Provider produktiv schalten", "Echte Verträge/API-Keys je Assetklasse aktivieren und Rate-Limits testen."],
  ["2", "Billing anbinden", "Planstatus serverseitig prüfen und UI-Gates gegen Backend-Entitlements absichern."],
  ["3", "Alert-Worker aktivieren", "Serverseitige Ausführung für Kurs-, News-, Risiko- und Earnings-Alarme einplanen."],
  ["4", "Audit & Monitoring", "Providerfehler, Latenzen, Nutzeraktionen und Export-/Import-Ereignisse beobachtbar machen."]
];

function readinessTone(status: string) {
  if (status === "ready") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "partial") return "border-amber/25 bg-amber/10 text-amber";
  return "border-loss/25 bg-loss/10 text-loss";
}

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

      <OnboardingPanel />

      <InvestorModeDock />

      <FunctionAssurancePanel />

      <ProviderHealthCenter />

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-profit/25 bg-profit/10 text-profit">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-mist">Produktionskontrollen</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Diese Leitplanken halten StockPilot ehrlich: Datenstatus, Auth, Rate-Limits und Risiko-Hinweise sind Teil der Oberfläche,
              nicht nur technische Details im Hintergrund.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {productionChecklist.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-stroke bg-coal/70 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
              <p className="text-sm leading-6 text-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-amber/25 bg-amber/10 text-amber">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-mist">Operative Produkt-Roadmap</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Diese Schritte machen aus der Demo-Struktur eine stärker produktionsfähige Finanz-App.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operationalRoadmap.map(([step, title, text]) => (
            <article key={step} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-amber/25 bg-amber/10 font-mono text-sm text-amber">{step}</span>
              <p className="mt-3 font-semibold text-mist">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-profit/25 bg-profit/10 text-profit">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-mist">Live-Readiness-Ampel</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Diese Übersicht zeigt Code-/UI-Readiness, nicht automatisch echten Live-Betrieb. Provider, Billing,
              Supabase-RLS und Börsenlizenzen müssen in der Produktionsumgebung separat bestätigt werden.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {liveReadinessChecks.map((item) => (
            <article key={item.label} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${readinessTone(item.status)}`}>
                {item.status}
              </span>
              <p className="mt-3 font-semibold text-mist">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan/25 bg-cyan/10 text-cyan">
            <DatabaseZap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-mist">Datenquellen- und Lizenzpolitik</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              StockPilot AI behandelt Datenqualität als Produktfunktion. Jede Anzeige muss erklären können,
              ob sie live, verzögert, gecached, mock oder nicht verfügbar ist.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dataSourcePolicy.map(([label, text]) => (
            <article key={label} className="rounded-2xl border border-stroke bg-coal/70 p-4">
              <p className="font-semibold text-cyan">{label}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

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
