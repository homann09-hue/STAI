"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Building2, CircleDollarSign, LockKeyhole, Radar, ShieldAlert } from "lucide-react";
import { criticalFunctionRisks, functionReadinessScore, functionStatusSummary } from "@/lib/function-audit";
import { formatCompact, formatCurrency, formatPercent, riskTone, scoreLabel, scoreTone } from "@/lib/scoring";
import type { DashboardData } from "@/lib/types";

export function DashboardCommandGrid({ data }: { data: DashboardData }) {
  const strongest = [...data.watchlist].sort((a, b) => b.scores.total - a.scores.total).slice(0, 3);
  const riskiest = [...data.watchlist]
    .sort((a, b) => (b.riskReport?.score ?? b.scores.risk) - (a.riskReport?.score ?? a.scores.risk))
    .slice(0, 3);
  const productHealthCards = [
    { icon: Radar, label: "Funktionsreife", value: `${functionReadinessScore}/100`, detail: "Live, Demo und vorbereitete Module bewertet" },
    { icon: BarChart3, label: "Aktiv", value: `${functionStatusSummary.live}`, detail: "direkt nutzbare Kernfunktionen" },
    { icon: CircleDollarSign, label: "Demo/Gates", value: `${functionStatusSummary.demo + functionStatusSummary.prepared}`, detail: "klar markiert, kein Fake-Pro-Status" },
    { icon: Building2, label: "Provider-Limits", value: `${functionStatusSummary.degraded}`, detail: "abhängig von APIs, Lizenzen oder Datenfrische" },
    { icon: LockKeyhole, label: "Top-Risiko", value: criticalFunctionRisks[0]?.area ?? "keines", detail: criticalFunctionRisks[0]?.dependency ?? "keine priorisierte Lücke" }
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <div className="rounded-[1.4rem] border border-stroke bg-panel/80 p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Asset Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold">Chancen und Risiken je Asset</h2>
          </div>
          <Link
            href="/learn"
            className="flex items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan"
          >
            <BookOpen className="h-4 w-4" />
            Lernen
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {strongest.map((item) => (
            <Link
              key={item.asset.symbol}
              href={`/assets/${encodeURIComponent(item.asset.symbol)}`}
              className="rounded-2xl border border-stroke bg-ink/45 p-4 transition hover:border-profit/40 hover:bg-panel2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.asset.symbol}</p>
                  <p className="mt-1 text-xs text-muted">{item.asset.type.toUpperCase()} · {item.asset.sector}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>
              <p className={`mt-4 font-mono text-3xl font-semibold ${scoreTone(item.scores.total)}`}>
                {item.scores.total}
              </p>
              <p className="mt-1 text-xs text-muted">{scoreLabel(item.scores.total)}</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Kurs {formatCurrency(item.quote.price, item.asset.currency)}, Tagesbewegung {formatPercent(item.quote.changePercent)}.
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-stroke bg-panel/80 p-5 shadow-panel">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber/30 bg-amber/10 text-amber">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Risk Desk</p>
            <h2 className="text-xl font-semibold">Was zuerst prüfen?</h2>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {riskiest.map((item) => (
            <Link
              key={item.asset.symbol}
              href={`/assets/${encodeURIComponent(item.asset.symbol)}`}
              className="block rounded-2xl border border-stroke bg-ink/45 p-3 transition hover:border-amber/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.asset.symbol}</p>
                  <p className="text-xs text-muted">Volumen {formatCompact(item.quote.volume)}</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(item.aiRisk)}`}>
                  {item.aiRisk}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {productHealthCards.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-2xl border border-stroke bg-panel2 p-3">
                <Icon className="h-4 w-4 text-cyan" />
                <p className="mt-2 text-sm font-semibold">{item.label}</p>
                <p className="text-xs font-semibold text-mist">{item.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
              </div>
            );
          })}
        </div>

        <Link
          href="/settings"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:border-cyan/60"
        >
          Funktionsstatus prüfen
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
