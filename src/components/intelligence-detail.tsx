import { AlertTriangle, ArrowLeft, ExternalLink, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataQualityBadge } from "@/components/data-quality-indicator";
import type { IntelligenceFeedItem } from "@/lib/intelligence/types";

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function quality(event: IntelligenceFeedItem) {
  if (event.latencyClass === "streaming") return "realtime" as const;
  if (event.latencyClass === "near_real_time") return "near_realtime" as const;
  if (event.latencyClass === "end_of_day") return "historical" as const;
  return "delayed" as const;
}

export function IntelligenceDetail({ event }: { event: IntelligenceFeedItem }) {
  const sourceUrl = safeSourceUrl(event.sourceUrl);
  return (
    <div className="space-y-4">
      <Link href="/intelligence" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan"><ArrowLeft className="h-4 w-4" /> Intelligence Feed</Link>
      <section className="rounded-3xl border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(41,121,255,0.16),transparent_40%),#0a1525] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-cyan/10 px-3 py-1 font-black text-cyan">{event.primarySymbol ?? "OFFEN"}</span><DataQualityBadge quality={quality(event)} /><span className="rounded-lg border border-stroke px-3 py-1 text-xs text-muted">{event.confirmationStatus.replaceAll("_", " ")}</span></div>
        <h1 className="mt-4 max-w-4xl text-2xl font-black leading-tight text-mist sm:text-4xl">{event.title}</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-muted">{event.summary}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted"><span>Provider: {event.provider}</span><span>Publisher: {event.publisher}</span><span>Latenz: {event.latencyClass.replaceAll("_", " ")}</span>{sourceUrl ? <Link href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan">Primärquelle öffnen <ExternalLink className="h-3 w-3" /></Link> : null}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[{ label: "Impact", value: event.impactScore }, { label: "Konfidenz", value: event.confidenceScore }, { label: "Glaubwürdigkeit", value: event.credibilityScore }].map((metric) => <div key={metric.label} className="rounded-2xl border border-stroke bg-panel p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted">{metric.label}</p><p className="mt-2 font-mono text-3xl font-black text-mist">{Math.round(metric.value)}<span className="text-base text-muted">/100</span></p></div>)}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-panel p-5"><h2 className="flex items-center gap-2 font-bold text-mist"><ShieldCheck className="h-4 w-4 text-profit" /> Extrahierte Fakten</h2><div className="mt-4 space-y-3">{event.facts.map((fact, index) => <article key={`${fact.statement}-${index}`} className="rounded-xl border border-stroke bg-panel2 p-4"><p className="text-sm font-semibold text-mist">{fact.statement}</p><p className="mt-2 text-xs leading-5 text-muted">Beleg: {fact.sourceEvidence}</p><p className="mt-2 text-xs text-cyan">Fakt-Konfidenz {Math.round(fact.confidence * 100)}%</p></article>)}</div></div>
        <div className="rounded-2xl border border-stroke bg-panel p-5"><h2 className="flex items-center gap-2 font-bold text-mist"><Scale className="h-4 w-4 text-cyan" /> Modellinterpretation</h2><p className="mt-4 text-sm leading-6 text-muted">{event.reasoningSummary}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-profit/20 bg-profit/8 p-3"><p className="text-xs font-bold text-profit">Positive Faktoren</p>{event.bullishFactors.map((item) => <p key={item} className="mt-2 text-xs leading-5 text-muted">{item}</p>)}</div><div className="rounded-xl border border-loss/20 bg-loss/8 p-3"><p className="text-xs font-bold text-loss">Negative Faktoren</p>{event.bearishFactors.map((item) => <p key={item} className="mt-2 text-xs leading-5 text-muted">{item}</p>)}</div></div></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-amber/20 bg-amber/8 p-5"><h2 className="flex items-center gap-2 font-bold text-amber"><AlertTriangle className="h-4 w-4" /> Unsicherheiten und Datenlücken</h2>{event.uncertainties.length ? event.uncertainties.map((item) => <p key={item} className="mt-3 text-sm leading-6 text-muted">{item}</p>) : <p className="mt-3 text-sm text-muted">Keine Unsicherheit dokumentiert. Das ist keine Garantie für Vollständigkeit.</p>}{event.requiresHumanReview ? <p className="mt-4 rounded-xl border border-amber/25 bg-amber/10 p-3 text-xs text-amber">Dieses Ereignis erfordert eine menschliche Prüfung.</p> : null}</div>
        <div className="rounded-2xl border border-stroke bg-panel p-5"><h2 className="font-bold text-mist">Score-Aufschlüsselung</h2><div className="mt-4 space-y-2">{Object.entries(event.scoreComponents).map(([key, value]) => <div key={key} className="flex items-center justify-between border-b border-stroke py-2 text-sm"><span className="text-muted">{key.replace(/([A-Z])/g, " $1")}</span><span className="font-mono text-mist">{value === null ? "n/a" : Math.round(value)}</span></div>)}</div><p className="mt-3 text-xs leading-5 text-muted">Ein hoher Impact misst erwartete Bedeutung. Er ist kein Kauf- oder Verkaufssignal.</p></div>
      </section>

      <p className="rounded-2xl border border-stroke bg-panel2 p-4 text-xs leading-5 text-muted">Keine Anlageberatung. Fakten, algorithmische Interpretation und Unsicherheiten sind getrennt dargestellt. Quelle, Zeitstempel und Bestätigungsstatus vor jeder Entscheidung selbst prüfen.</p>
    </div>
  );
}
