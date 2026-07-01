import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, LockKeyhole, RadioTower, ShieldAlert } from "lucide-react";
import {
  appFunctionAudits,
  criticalFunctionRisks,
  functionReadinessScore,
  functionStatusSummary,
  getFunctionStatusLabel,
  getFunctionStatusTone
} from "@/lib/function-audit";
import type { AppFunctionStatus } from "@/lib/function-audit";

const statusCards: Array<{
  key: AppFunctionStatus;
  label: string;
  description: string;
}> = [
  { key: "live", label: "Aktiv", description: "funktioniert nutzbar" },
  { key: "degraded", label: "Eingeschränkt", description: "Provider-/Datenlimit" },
  { key: "demo", label: "Demo", description: "klar markiert" },
  { key: "prepared", label: "Vorbereitet", description: "Backend/API fehlt" },
  { key: "blocked", label: "Blockiert", description: "nicht nutzbar" }
];

export function FunctionAssurancePanel({ compact = false }: { compact?: boolean }) {
  const visibleAudits = compact ? appFunctionAudits.slice(0, 8) : appFunctionAudits;

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
          <p className="mt-3 font-mono text-4xl font-semibold">{functionReadinessScore}/100</p>
          <p className="mt-1 text-xs text-muted">Produktreife nach Funktionsstatus</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((item) => (
          <div key={item.key} className={`rounded-2xl border p-3 ${getFunctionStatusTone(item.key)}`}>
            <p className="text-xs font-semibold">{item.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{functionStatusSummary[item.key]}</p>
            <p className="mt-1 text-xs text-muted">{item.description}</p>
          </div>
        ))}
      </div>

      {criticalFunctionRisks.length > 0 ? (
        <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
            <div>
              <h3 className="font-semibold text-amber">Wichtigste Produktlücken</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {criticalFunctionRisks.length} priorisierte Bereiche brauchen noch echte Provider,
                Billing, Backend-Jobs oder vollstaendige Datenabdeckung.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
                  href={item.route === "app-shell" ? "/settings" : item.route}
                  className="inline-flex min-h-7 items-center font-semibold text-mist transition hover:text-cyan"
                >
                  {item.area}
                </Link>
                <p className="mt-1 text-xs text-muted">{item.route}</p>
              </div>
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getFunctionStatusTone(item.status)}`}>
                  {getFunctionStatusLabel(item.status)}
                </span>
                <p className="mt-2 text-xs text-muted">Priorität {item.priority}</p>
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
          Vollständigen Funktionsstatus öffnen
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
