import { Activity, AlertTriangle, CheckCircle2, DatabaseZap, LockKeyhole, RadioTower, ShieldAlert } from "lucide-react";
import { getProviderHealthReport, type ProviderOperationalStatus } from "@/lib/provider-health";

const statusLabels: Record<ProviderOperationalStatus, string> = {
  ready: "Bereit",
  configured: "Konfiguriert",
  degraded: "Eingeschränkt",
  missing_key: "Key fehlt",
  license_required: "Lizenz nötig",
  demo: "Demo"
};

const statusTone: Record<ProviderOperationalStatus, string> = {
  ready: "border-profit/30 bg-profit/10 text-profit",
  configured: "border-cyan/30 bg-cyan/10 text-cyan",
  degraded: "border-amber/30 bg-amber/10 text-amber",
  missing_key: "border-loss/30 bg-loss/10 text-loss",
  license_required: "border-amber/30 bg-amber/10 text-amber",
  demo: "border-steel/30 bg-steel/10 text-steel"
};

const statusOrder: ProviderOperationalStatus[] = ["ready", "configured", "degraded", "demo", "license_required", "missing_key"];

function qualityLabel(quality: string) {
  if (quality === "near_realtime") return "NEAR_REALTIME";
  if (quality === "not_applicable") return "nicht relevant";
  return quality.toUpperCase();
}

export function ProviderHealthCenter() {
  const report = getProviderHealthReport();

  return (
    <section className="space-y-4 rounded-[1.7rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(39,224,183,0.12),transparent_30%),linear-gradient(145deg,rgba(8,14,24,0.98),rgba(3,7,13,0.98))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-profit">
            Provider Health & Datenkontrolle
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">
            Welche Daten sind echt, limitiert, Demo oder nur vorbereitet?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Dieses Kontrollzentrum zeigt API-Keys, Anbieterstatus, Datenqualität, Fallbacks,
            Limitierungen und nächste Backend-Schritte, ohne Geheimnisse offenzulegen.
          </p>
        </div>
        <div className="rounded-2xl border border-profit/25 bg-profit/10 p-4 text-profit xl:min-w-52">
          <div className="flex items-center gap-2">
            <RadioTower className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">Data Readiness</p>
          </div>
          <p className="mt-3 font-mono text-4xl font-semibold">{report.readinessScore}/100</p>
          <p className="mt-1 text-xs text-muted">Stand {new Date(report.generatedAt).toLocaleString("de-DE")}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {statusOrder.map((status) => (
          <div key={status} className={`rounded-2xl border p-3 ${statusTone[status]}`}>
            <p className="text-xs font-semibold">{statusLabels[status]}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{report.totals[status]}</p>
            <p className="mt-1 text-xs text-muted">Provider</p>
          </div>
        ))}
      </div>

      {report.topRisks.length ? (
        <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
            <div>
              <h3 className="font-semibold text-amber">Wichtigste offene Datenrisiken</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {report.topRisks.map((item) => item.name).join(", ")} brauchen noch Keys,
                Lizenzen, Shared Cache oder echte Backend-Gates.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.95fr_0.75fr_0.85fr_1.3fr_1.3fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted xl:grid">
          <span>Provider</span>
          <span>Status</span>
          <span>Qualität</span>
          <span>User-Impact</span>
          <span>Nächster Schritt</span>
        </div>
        <div className="divide-y divide-stroke">
          {report.items.map((item) => (
            <article key={item.id} className="grid gap-3 bg-panel/55 px-4 py-4 xl:grid-cols-[0.95fr_0.75fr_0.85fr_1.3fr_1.3fr] xl:items-start">
              <div>
                <p className="font-semibold text-mist">{item.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{item.category}</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Env: {[...(item.publicEnv ?? []), ...item.secretEnv].join(", ") || "keine Keys nötig"}
                </p>
              </div>
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>
              <span className="inline-flex w-fit rounded-full border border-stroke bg-coal px-3 py-1 text-xs font-semibold text-muted">
                {qualityLabel(item.quality)}
              </span>
              <p className="text-sm leading-6 text-muted">{item.userImpact}</p>
              <p className="text-sm leading-6 text-muted">{item.nextAction}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
          <CheckCircle2 className="h-4 w-4 text-profit" />
          <p className="mt-2 text-sm font-semibold text-mist">Keine Secret-Leaks</p>
          <p className="mt-1 text-xs leading-5 text-muted">Es werden nur Key-Namen und Status gezeigt, nie Werte.</p>
        </div>
        <div className="rounded-2xl border border-cyan/25 bg-cyan/10 p-3">
          <DatabaseZap className="h-4 w-4 text-cyan" />
          <p className="mt-2 text-sm font-semibold text-mist">Provider-Fallbacks</p>
          <p className="mt-1 text-xs leading-5 text-muted">Fehlende Anbieter fallen auf Cache, andere Provider oder Demo zurück.</p>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3">
          <Activity className="h-4 w-4 text-amber" />
          <p className="mt-2 text-sm font-semibold text-mist">Rate-Limits sichtbar</p>
          <p className="mt-1 text-xs leading-5 text-muted">Backoff und Cache schützen App und Anbieter vor Überlast.</p>
        </div>
        <div className="rounded-2xl border border-steel/25 bg-steel/10 p-3">
          <LockKeyhole className="h-4 w-4 text-steel" />
          <p className="mt-2 text-sm font-semibold text-mist">Backend-Gates</p>
          <p className="mt-1 text-xs leading-5 text-muted">Billing, Alerts und Userdaten wirken erst aktiv, wenn sie echt geprüft sind.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-cyan" />
          <p className="text-sm font-semibold text-mist">Nächste Backend-Aktionen</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {report.nextActions.map((action) => (
            <p key={action} className="rounded-xl border border-stroke bg-panel/70 px-3 py-2 text-xs leading-5 text-muted">
              {action}
            </p>
          ))}
        </div>
        <p className="mt-3 rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs leading-5 text-cyan">
          Live-Ping-Endpoint: /api/providers/ping prüft konfigurierte Provider serverseitig mit Timeout, ohne API-Key-Werte offenzulegen.
        </p>
      </div>
    </section>
  );
}
