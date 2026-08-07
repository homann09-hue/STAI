import { AlertTriangle, CheckCircle2, HelpCircle, Lock, TrendingDown } from "lucide-react";
import type { TrackRecordMetric, TrackRecordView } from "@/lib/forecast-track-record";

/**
 * Anzeige der Trefferbilanz.
 *
 * Gestaltungsprinzip: die Einschränkungen sind kein Kleingedrucktes am Ende,
 * sondern stehen gleichwertig neben den Zahlen. Eine Bilanz, die ihre eigenen
 * Grenzen versteckt, ist Werbung.
 */

function toneClasses(tone: TrackRecordMetric["tone"]) {
  if (tone === "good") return "border-profit/25 bg-profit/10 text-profit";
  if (tone === "warn") return "border-amber/25 bg-amber/10 text-amber";
  if (tone === "bad") return "border-loss/25 bg-loss/10 text-loss";
  return "border-stroke bg-coal text-mist";
}

function ReadinessBanner({ view }: { view: TrackRecordView }) {
  const config =
    view.readiness === "reportable"
      ? { Icon: CheckCircle2, classes: "border-profit/25 bg-profit/10 text-profit" }
      : view.readiness === "insufficient_sample"
        ? { Icon: AlertTriangle, classes: "border-amber/25 bg-amber/10 text-amber" }
        : { Icon: HelpCircle, classes: "border-stroke bg-coal text-muted" };

  return (
    <section className={`rounded-3xl border p-5 ${config.classes}`}>
      <div className="flex items-start gap-3">
        <config.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-mist">{view.headline}</h2>
          <p className="mt-1 text-sm">{view.explanation}</p>
        </div>
      </div>
    </section>
  );
}

export function ForecastTrackRecordView({
  view,
  model,
  window
}: {
  view: TrackRecordView;
  model: { key: string; version: string } | null;
  window: { start: string; end: string } | null;
}) {
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("de-DE");
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-mist">Trefferbilanz</h1>
        <p className="mt-1 text-sm text-muted">
          Jede veröffentlichte Prognose wird gespeichert und nach Ablauf ihres Horizonts gegen den
          tatsächlichen Kurs geprüft. Einträge sind unveränderlich — schlechte Prognosen lassen sich
          technisch nicht nachträglich entfernen.
        </p>
      </header>

      <ReadinessBanner view={view} />

      {view.metrics.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {view.metrics.map((metric) => (
            <article key={metric.label} className={`rounded-2xl border p-4 ${toneClasses(metric.tone)}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{metric.label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-mist">{metric.value}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{metric.meaning}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Was diese Zahlen nicht aussagen
          </h2>
        </div>
        <ul className="mt-3 space-y-2">
          {view.caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2 text-sm text-muted">
              <span aria-hidden="true">·</span>
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-stroke bg-panel p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Methodik</h2>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Modell</dt>
            <dd className="mt-0.5 truncate font-mono text-sm text-mist">
              {model ? `${model.key} ${model.version}` : "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Zeitfenster</dt>
            <dd className="mt-0.5 text-sm text-mist">
              {window ? `${formatDate(window.start)} – ${formatDate(window.end)}` : "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Vergleichsmaßstab</dt>
            <dd className="mt-0.5 text-sm text-mist">Unveränderter Kurs (naive Baseline)</dd>
          </div>
          <div className="rounded-2xl border border-stroke bg-coal px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Mindeststichprobe</dt>
            <dd className="mt-0.5 text-sm text-mist">{view.minimumSampleSize} bewertete Prognosen</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted">
          Prognosen mit Mock- oder nicht verfügbaren Kursen fließen nicht in die Bilanz ein. Prognosen,
          die zum Erstellungszeitpunkt wegen schwacher Datenlage blockiert waren, werden nicht
          bewertet und zählen nicht als Treffer.
        </p>
      </section>
    </div>
  );
}
