import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, LockKeyhole, RadioTower, ShieldAlert } from "lucide-react";
import type { AppFunctionStatus } from "@/lib/function-audit";

const statusCards: Array<{
  key: AppFunctionStatus;
  label: string;
}> = [
  { key: "live", label: "Aktiv" },
  { key: "degraded", label: "Eingeschränkt" },
  { key: "demo", label: "Demo" },
  { key: "prepared", label: "Vorbereitet" },
  { key: "blocked", label: "Blockiert" }
];
const publicFunctionRows = [
  {
    id: "market-data",
    area: "Marktdaten & Watchlist",
    route: "/markets",
    dataTruth: "Kurse zeigen Datenqualität, Providerstatus, Cache-/Fallback-Hinweise und keine Fake-Realtime-Labels.",
    improvement: "Konkrete Providerdiagnostik bleibt admin-geschützt."
  },
  {
    id: "portfolio-alerts",
    area: "Portfolio & Alarme",
    route: "/portfolio",
    dataTruth: "Lokale Funktionen sind nutzbar, Cloud-/Worker-Funktionen werden nur mit echter Session und Backend-Gate aktiv dargestellt.",
    improvement: "Serverjobs und Benachrichtigungskanäle bleiben statusklar."
  },
  {
    id: "analysis-news",
    area: "News & Analysen",
    route: "/news-terminal",
    dataTruth: "News, KI-Texte und Scores bleiben modellbasierte Einschätzungen mit Quellen- und Qualitätsstatus.",
    improvement: "Mock, delayed, cached und unavailable werden getrennt kommuniziert."
  },
  {
    id: "learning-settings",
    area: "Lernen & Einstellungen",
    route: "/learn",
    dataTruth: "Lerninhalte sind Bildung, keine Anlageberatung; Einstellungen erklären Datenverhalten statt interne Roadmap offenzulegen.",
    improvement: "Admin-/Providerdetails bleiben geschützt."
  }
];

function publicFunctionStatusTone(status: AppFunctionStatus) {
  if (status === "live") return "border-profit/30 bg-profit/10 text-profit";
  if (status === "degraded") return "border-amber/30 bg-amber/10 text-amber";
  if (status === "demo") return "border-cyan/30 bg-cyan/10 text-cyan";
  if (status === "prepared") return "border-steel/30 bg-steel/10 text-steel";
  return "border-loss/30 bg-loss/10 text-loss";
}

export function FunctionAssurancePanel({ compact = false }: { compact?: boolean }) {
  const visibleAudits = compact ? publicFunctionRows.slice(0, 3) : publicFunctionRows;

  return (
    <section className="space-y-4 rounded-[1.7rem] border border-stroke bg-[radial-gradient(circle_at_top_left,rgba(120,231,255,0.12),transparent_30%),linear-gradient(145deg,rgba(9,14,24,0.96),rgba(3,6,11,0.98))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">
            Funktions- und Vertrauenscheck
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">
            Jede Funktion mit Status, Datenwahrheit und nächstem Fix
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            STAI zeigt nicht nur Features, sondern auch deren Reifegrad. So ist sofort sichtbar,
            was aktiv ist, was nur Demo ist und welche Bereiche echte Provider, Billing oder
            Backend-Jobs brauchen.
          </p>
        </div>
        <div className="rounded-2xl border border-profit/25 bg-profit/10 p-4 text-profit xl:min-w-52">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">Readiness</p>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold">geschützt</p>
          <p className="mt-1 text-xs text-muted">Details admin-geschützt</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((item) => (
          <div key={item.key} className={`rounded-2xl border p-3 ${publicFunctionStatusTone(item.key)}`}>
            <p className="text-xs font-semibold">{item.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">-</p>
            <p className="mt-1 text-xs text-muted">öffentliche Details geschützt</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div>
            <h3 className="font-semibold text-amber">Produktlücken werden nicht versteckt</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Öffentliche Nutzer sehen, ob Daten live, delayed, cached, mock oder unavailable sind.
              Interne Prioritäten, Reife-Scores und Backend-Diagnostik bleiben geschützt.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.9fr_0.85fr_1.35fr_1.35fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted xl:grid">
          <span>Funktion</span>
          <span>Status</span>
          <span>Datenwahrheit</span>
          <span>Nächster Fix</span>
        </div>
        <div className="divide-y divide-stroke">
          {visibleAudits.map((item) => (
            <article key={item.id} className="grid gap-3 bg-panel/55 px-4 py-4 xl:grid-cols-[0.9fr_0.85fr_1.35fr_1.35fr] xl:items-start">
              <div>
                <Link
                  href={item.route}
                  className="inline-flex min-h-7 items-center font-semibold text-mist transition hover:text-cyan"
                >
                  {item.area}
                </Link>
                <p className="mt-1 text-xs text-muted">öffentliche Zusammenfassung</p>
              </div>
              <div>
                <span className="inline-flex rounded-full border border-steel/30 bg-steel/10 px-3 py-1 text-xs font-semibold text-steel">
                  Details geschützt
                </span>
                <p className="mt-2 text-xs text-muted">Status pro Datenfläche sichtbar</p>
              </div>
              <p className="text-sm leading-6 text-muted">{item.dataTruth}</p>
              <p className="text-sm leading-6 text-muted">{item.improvement}</p>
            </article>
          ))}
        </div>
      </div>

      {compact ? (
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:border-cyan/60"
        >
          <RadioTower className="h-4 w-4" />
          Vertrauensübersicht öffnen
        </Link>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
            <CheckCircle2 className="h-4 w-4 text-profit" />
            <p className="mt-2 text-sm font-semibold text-mist">Keine Fake-Live-Logik</p>
            <p className="mt-1 text-xs leading-5 text-muted">Mock, delayed, cached und live bleiben sichtbar getrennt.</p>
          </div>
          <div className="rounded-2xl border border-cyan/25 bg-cyan/10 p-3">
            <CircleDashed className="h-4 w-4 text-cyan" />
            <p className="mt-2 text-sm font-semibold text-mist">MVP statt leere Seiten</p>
            <p className="mt-1 text-xs leading-5 text-muted">Vorbereitete Bereiche erklären Status, Datenbedarf und Nutzen.</p>
          </div>
          <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3">
            <LockKeyhole className="h-4 w-4 text-amber" />
            <p className="mt-2 text-sm font-semibold text-mist">Backend-Gates ehrlich</p>
            <p className="mt-1 text-xs leading-5 text-muted">Billing, Alerts und Serverjobs wirken nicht aktiv, wenn sie fehlen.</p>
          </div>
        </div>
      )}
    </section>
  );
}
