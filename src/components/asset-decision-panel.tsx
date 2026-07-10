"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Gauge, ShieldAlert } from "lucide-react";
import { formatPercent, riskTone, scoreLabel, scoreTone } from "@/lib/scoring";
import type { AssetDetail } from "@/lib/types";

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function probabilityPercent(value: number) {
  return formatPercent(clampScore(value) / 100);
}

function getDecision(detail: AssetDetail) {
  const riskScore = clampScore(detail.riskReport.score);
  const totalScore = clampScore(detail.scores.total);

  if (detail.aiRisk === "extrem" || riskScore >= 78) {
    return {
      label: "Hohes Risiko",
      tone: "border-loss/35 bg-loss/10 text-loss",
      icon: AlertTriangle,
      detail: "Nur beobachten, Risikotreiber prüfen und keine Modellwerte als Garantie verstehen."
    };
  }

  if (totalScore >= 68 && detail.dataQuality.sufficientForAnalysis && detail.aiRisk !== "hoch") {
    return {
      label: "Interessant",
      tone: "border-profit/35 bg-profit/10 text-profit",
      icon: CheckCircle2,
      detail: "Chancenbild ist konstruktiv, aber Positionsgröße und Datenqualität bleiben entscheidend."
    };
  }

  if (riskScore >= 58 || detail.aiRisk === "hoch") {
    return {
      label: "Vorsicht",
      tone: "border-amber/35 bg-amber/10 text-amber",
      icon: ShieldAlert,
      detail: "Es gibt relevante Warnsignale. Erst Ursachen, News und technische Lage prüfen."
    };
  }

  return {
    label: "Beobachten",
    tone: "border-cyan/35 bg-cyan/10 text-cyan",
    icon: Eye,
    detail: "Kein klares Signal. Beobachten, Alert setzen und weitere Daten abwarten."
  };
}

export function AssetDecisionPanel({ detail }: { detail: AssetDetail }) {
  const decision = getDecision(detail);
  const Icon = decision.icon;
  const totalScore = clampScore(detail.scores.total);
  const volatilityRisk = clampScore(detail.professionalScores.volatilityRisk);
  const dataQualityScore = clampScore(detail.dataQuality.score);
  const drivers = [
    { label: "Kurzfazit", value: detail.aiAnalysis.summary },
    { label: "News-Auswirkung", value: detail.news[0]?.summary ?? "Keine aktuelle News im Mock-Modell." },
    { label: "Unsicherheiten", value: detail.aiAnalysis.dataGaps[0] ?? "Keine zentrale Datenlücke gemeldet." }
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className={`rounded-[1.4rem] border p-5 shadow-panel ${decision.tone}`}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-current/30 bg-current/10">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] opacity-75">Handlungseinordnung</p>
            <h2 className="text-2xl font-semibold">{decision.label}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 opacity-90">{decision.detail}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-current/20 bg-ink/30 p-3">
            <p className="text-xs opacity-70">Gesamt-Score</p>
            <p className={`mt-1 font-mono text-2xl font-semibold ${scoreTone(totalScore)}`}>
              {totalScore}
            </p>
          </div>
          <div className="rounded-2xl border border-current/20 bg-ink/30 p-3">
            <p className="text-xs opacity-70">Volatilitätsrisiko</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{volatilityRisk}</p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 opacity-75">
          Keine Kauf-/Verkaufsempfehlung. Diese Einordnung ist eine modellbasierte Arbeitsnotiz.
        </p>
      </div>

      <div className="rounded-[1.4rem] border border-stroke bg-panel/80 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">KI Analysekarte</p>
            <h2 className="mt-1 text-xl font-semibold">Treiber, Datenqualität und Zeithorizont</h2>
          </div>
          <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(detail.aiRisk)}`}>
            Risiko {detail.aiRisk}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {drivers.map((driver) => (
            <div key={driver.label} className="rounded-2xl border border-stroke bg-ink/45 p-4">
              <p className="text-sm font-semibold">{driver.label}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{driver.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-panel2 p-3">
            <Gauge className="h-4 w-4 text-profit" />
            <p className="mt-2 text-xs text-muted">Chance steigend</p>
            <p className="font-mono text-xl font-semibold">{probabilityPercent(detail.aiAnalysis.probabilities.up)}</p>
          </div>
          <div className="rounded-2xl bg-panel2 p-3">
            <Gauge className="h-4 w-4 text-loss" />
            <p className="mt-2 text-xs text-muted">Chance fallend</p>
            <p className="font-mono text-xl font-semibold">{probabilityPercent(detail.aiAnalysis.probabilities.down)}</p>
          </div>
          <div className="rounded-2xl bg-panel2 p-3">
            <ArrowRight className="h-4 w-4 text-cyan" />
            <p className="mt-2 text-xs text-muted">Seitwärts</p>
            <p className="font-mono text-xl font-semibold">{probabilityPercent(detail.aiAnalysis.probabilities.sideways)}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Score-Label: {scoreLabel(totalScore)} · Datenqualität {dataQualityScore}/100 ·
          Unsicherheit {detail.aiAnalysis.uncertainty}
        </p>
      </div>
    </section>
  );
}
