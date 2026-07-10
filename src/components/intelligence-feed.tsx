"use client";

import { AlertTriangle, ExternalLink, Filter, Radar, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataQualityBadge } from "@/components/data-quality-indicator";
import type { IntelligenceFeedItem, IntelligenceFeedResult } from "@/lib/intelligence/types";

const directionLabels = { positive: "Positiv", negative: "Negativ", mixed: "Gemischt", unclear: "Unklar" };
const confirmationLabels = {
  confirmed: "Bestätigt",
  partially_confirmed: "Teilbestätigt",
  unconfirmed: "Unbestätigt",
  ambiguous: "Zuordnung offen"
};

function qualityFromLatency(latency: IntelligenceFeedItem["latencyClass"]) {
  if (latency === "streaming") return "realtime" as const;
  if (latency === "near_real_time") return "near_realtime" as const;
  if (latency === "end_of_day") return "historical" as const;
  return "delayed" as const;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(date)
    : "Zeit unbekannt";
}

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function directionTone(direction: IntelligenceFeedItem["direction"]) {
  if (direction === "positive") return "border-profit/30 bg-profit/10 text-profit";
  if (direction === "negative") return "border-loss/30 bg-loss/10 text-loss";
  if (direction === "mixed") return "border-amber/30 bg-amber/10 text-amber";
  return "border-stroke bg-panel2 text-muted";
}

export function IntelligenceFeed({ result }: { result: IntelligenceFeedResult }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [confirmation, setConfirmation] = useState("all");
  const [minImpact, setMinImpact] = useState(0);
  const events = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return result.events.filter((event) => {
      const matchesQuery = !normalizedQuery || `${event.primarySymbol ?? ""} ${event.title} ${event.provider}`.toLowerCase().includes(normalizedQuery);
      return matchesQuery &&
        (direction === "all" || event.direction === direction) &&
        (confirmation === "all" || event.confirmationStatus === confirmation) &&
        event.impactScore >= minImpact;
    });
  }, [confirmation, direction, minImpact, query, result.events]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-[#22324a] bg-[radial-gradient(circle_at_top_right,rgba(41,121,255,0.18),transparent_42%),linear-gradient(135deg,#0b1728,#07111f)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan">
              <Radar className="h-4 w-4" /> Realtime Intelligence
              <span className="rounded-full border border-stroke bg-[#07111f]/70 px-2 py-1 text-muted">Source-backed</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-mist sm:text-4xl">Ereignisse verstehen, Quellen prüfen.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Unternehmensnachrichten und regulatorische Meldungen werden normalisiert, dedupliziert und transparent bewertet. Impact bedeutet Bedeutung, nicht garantierte Kursrichtung.
            </p>
          </div>
          <div className="rounded-2xl border border-stroke bg-[#07111f]/70 p-4 text-xs text-muted">
            <p className="font-semibold text-mist">Pipeline-Status</p>
            <p className="mt-1">{result.configured ? `${result.events.length} belegte Ereignisse` : "Nicht konfiguriert"}</p>
            <p className="mt-1">Stand: {formatDate(result.generatedAt)}</p>
          </div>
        </div>
      </section>

      {!result.configured || result.warning ? (
        <div className={`rounded-2xl border p-4 text-sm leading-6 ${result.configured ? "border-amber/25 bg-amber/10 text-amber" : "border-loss/25 bg-loss/10 text-loss"}`}>
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Datenstatus</div>
          <p className="mt-1">{result.warning}</p>
          {!result.configured ? <p className="mt-1">Es werden keine Mock-Ereignisse als Ersatz angezeigt.</p> : null}
        </div>
      ) : null}

      <section className="rounded-2xl border border-stroke bg-panel p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-mist"><Filter className="h-4 w-4 text-cyan" /> Feed filtern</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-muted">Unternehmen oder Ereignis
            <input className="mt-1 h-11 w-full rounded-xl border border-stroke bg-panel2 px-3 text-sm text-mist outline-none focus:border-cyan/50" value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} placeholder="z. B. NVDA oder Guidance" />
          </label>
          <label className="text-xs text-muted">Richtung
            <select className="mt-1 h-11 w-full rounded-xl border border-stroke bg-panel2 px-3 text-sm text-mist" value={direction} onChange={(event) => setDirection(event.target.value)}>
              <option value="all">Alle Richtungen</option><option value="positive">Positiv</option><option value="negative">Negativ</option><option value="mixed">Gemischt</option><option value="unclear">Unklar</option>
            </select>
          </label>
          <label className="text-xs text-muted">Bestätigung
            <select className="mt-1 h-11 w-full rounded-xl border border-stroke bg-panel2 px-3 text-sm text-mist" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}>
              <option value="all">Alle Status</option><option value="confirmed">Bestätigt</option><option value="partially_confirmed">Teilbestätigt</option><option value="unconfirmed">Unbestätigt</option><option value="ambiguous">Zuordnung offen</option>
            </select>
          </label>
          <label className="text-xs text-muted">Mindest-Impact: {minImpact}
            <input className="mt-3 w-full accent-cyan" type="range" min="0" max="100" step="10" value={minImpact} onChange={(event) => setMinImpact(Number(event.target.value))} />
          </label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2" aria-live="polite">
        {events.map((event) => {
          const sourceUrl = safeSourceUrl(event.sourceUrl);
          return (
            <article key={event.id} className="group rounded-2xl border border-stroke bg-panel p-5 transition hover:border-cyan/30 hover:bg-[#0d1a2b]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-cyan/10 px-2.5 py-1 text-xs font-black text-cyan">{event.primarySymbol ?? "ZUORDNUNG OFFEN"}</span>
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${directionTone(event.direction)}`}>{directionLabels[event.direction]}</span>
                <span className="rounded-lg border border-stroke bg-panel2 px-2.5 py-1 text-xs text-muted">{confirmationLabels[event.confirmationStatus]}</span>
                <DataQualityBadge quality={qualityFromLatency(event.latencyClass)} compact />
              </div>
              <h2 className="mt-4 text-lg font-bold leading-7 text-mist">{event.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{event.summary}</p>
              <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted"><span>Impact</span><span>{event.impactScore}/100</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-[#5f72ff]" style={{ width: `${event.impactScore}%` }} /></div>
                </div>
                <div className="text-right"><p className="text-xs text-muted">Konfidenz</p><p className="font-mono text-lg font-bold text-mist">{Math.round(event.confidenceScore)}%</p></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4 text-xs text-muted">
                <span>{event.publisher} · {formatDate(event.eventTime)}</span>
                <div className="flex gap-2">
                  {sourceUrl ? <Link href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-stroke px-2.5 py-1.5 text-cyan hover:border-cyan/40">Quelle <ExternalLink className="h-3 w-3" /></Link> : null}
                  <Link href={`/intelligence/${event.id}`} className="inline-flex items-center gap-1 rounded-lg bg-cyan/10 px-2.5 py-1.5 font-semibold text-cyan">Details <ShieldCheck className="h-3 w-3" /></Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!events.length ? <div className="rounded-2xl border border-dashed border-stroke bg-panel/60 p-10 text-center"><Radar className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-semibold text-mist">Keine passenden Ereignisse</p><p className="mt-1 text-sm text-muted">Filter ändern oder nach erfolgreicher Ingestion erneut laden.</p></div> : null}

      <p className="rounded-2xl border border-stroke bg-panel2 p-4 text-xs leading-5 text-muted">
        Keine Anlageberatung. Fakten stammen aus verlinkten Quellen; Zusammenfassungen, Richtung und Impact sind algorithmische Interpretationen und können falsch sein.
      </p>
    </div>
  );
}
