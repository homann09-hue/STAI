"use client";

import { AlertTriangle, DatabaseZap, Layers3, ShieldCheck } from "lucide-react";
import {
  formatCurrency,
  probabilityDisclaimer,
  riskTone,
  scoreLabel,
  sentimentTone
} from "@/lib/scoring";
import type {
  AnalysisLayer,
  DataQualityReport,
  MacroFactor,
  ProfessionalScores,
  RiskEngineReport
} from "@/lib/types";

function SmallMeter({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-mono text-lg font-semibold">{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stroke">
        <div
          className={`h-full rounded-full ${danger ? "bg-gradient-to-r from-profit via-amber to-loss" : "bg-gradient-to-r from-loss via-amber to-profit"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function ProfessionalScoresPanel({ scores }: { scores: ProfessionalScores }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SmallMeter label="Technical" value={scores.technical} />
        <SmallMeter label="Fundamental" value={scores.fundamental} />
        <SmallMeter label="News" value={scores.news} />
        <SmallMeter label="Sentiment" value={scores.sentiment} />
        <SmallMeter label="Momentum" value={scores.momentum} />
        <SmallMeter label="Volatility Risk" value={scores.volatilityRisk} danger />
        <SmallMeter label="Liquidity Risk" value={scores.liquidityRisk} danger />
        <SmallMeter label="Event Risk" value={scores.eventRisk} danger />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-profit/25 bg-profit/10 p-4">
          <p className="text-sm text-muted">Gesamt-Chancen-Score</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-profit">{scores.opportunityTotal}/100</p>
          <p className="mt-2 text-xs text-muted">{scoreLabel(scores.opportunityTotal)}</p>
        </div>
        <div className="rounded-md border border-loss/25 bg-loss/10 p-4">
          <p className="text-sm text-muted">Gesamt-Risiko-Score</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-loss">{scores.riskTotal}/100</p>
          <p className="mt-2 text-xs text-muted">Höherer Wert bedeutet höheres Modellrisiko.</p>
        </div>
      </div>
    </div>
  );
}

export function ProbabilityPanel({ scores }: { scores: ProfessionalScores }) {
  return (
    <div className="rounded-md border border-amber/30 bg-amber/10 p-4">
      <p className="text-sm font-semibold text-amber">Modellbasierte Wahrscheinlichkeiten</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted">Steigender Kurs</p>
          <p className="font-mono text-2xl text-profit">{scores.probabilityUp}%</p>
        </div>
        <div>
          <p className="text-xs text-muted">Fallender Kurs</p>
          <p className="font-mono text-2xl text-loss">{scores.probabilityDown}%</p>
        </div>
        <div>
          <p className="text-xs text-muted">Seitwärts</p>
          <p className="font-mono text-2xl text-amber">{scores.probabilitySideways}%</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-amber">{probabilityDisclaimer}</p>
    </div>
  );
}

export function DataQualityPanel({ quality }: { quality: DataQualityReport }) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-cyan" />
            <p className="text-sm font-semibold">Datenqualität</p>
          </div>
          <p className="mt-1 text-xs text-muted">
            {quality.sourceLabel}, Vertrauen {quality.confidence}/100, Status {quality.freshness}
          </p>
        </div>
        <p className="font-mono text-2xl font-semibold">{quality.score}</p>
      </div>
      <div className="space-y-2">
        {quality.sources.map((source) => (
          <div key={source.name} className="rounded-md bg-panel2 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{source.name}</p>
              <span className="rounded-md border border-stroke px-2 py-1 text-[11px] text-muted">
                Rang {source.rank} · {source.status}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{source.note}</p>
          </div>
        ))}
      </div>
      {[...quality.issues, ...quality.warnings, ...quality.contradictions].map((item) => (
        <p key={item} className="mt-3 rounded-md border border-amber/25 bg-amber/10 p-2 text-xs leading-5 text-amber">
          {item}
        </p>
      ))}
    </div>
  );
}

export function RiskEnginePanel({ report }: { report: RiskEngineReport }) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber" />
            <p className="text-sm font-semibold">Risiko-Engine</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">{report.summary}</p>
        </div>
        <span className={`rounded-md border px-3 py-2 text-sm ${riskTone(report.level)}`}>
          {report.score}/100
        </span>
      </div>
      <div className="space-y-3">
        {report.findings.length === 0 ? (
          <p className="rounded-md bg-panel2 p-3 text-sm text-muted">
            Keine kritischen Modellwarnungen erkannt. Weiterhin Quellen und Risiko selbst prüfen.
          </p>
        ) : (
          report.findings.map((finding) => (
            <div key={finding.id} className="rounded-md bg-panel2 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{finding.title}</p>
                <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(finding.severity)}`}>
                  {finding.severity}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{finding.detail}</p>
              <p className="mt-2 text-xs text-amber">Beleg: {finding.evidence}</p>
              <p className="mt-1 text-xs text-muted">Prüfung: {finding.action}</p>
            </div>
          ))
        )}
      </div>
      {report.blockedAnalysis ? (
        <div className="mt-4 flex gap-2 rounded-md border border-loss/30 bg-loss/10 p-3 text-xs leading-5 text-loss">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Datenlage oder Risiko ist zu kritisch. Keine belastbare Analyse ableiten, bevor Quellen geprüft wurden.
        </div>
      ) : null}
    </div>
  );
}

export function AnalysisLayersPanel({
  layers,
  macroFactors
}: {
  layers: AnalysisLayer[];
  macroFactors: MacroFactor[];
}) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-cyan" />
        <p className="text-sm font-semibold">Multi-Layer-Analyse</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {layers.map((layer) => (
          <div key={layer.label} className="rounded-md bg-panel2 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{layer.label}</p>
              <span className={`rounded-md border px-2 py-1 text-[11px] ${sentimentTone(layer.status === "risk" ? "negative" : layer.status)}`}>
                {layer.value}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{layer.detail}</p>
            <p className="mt-2 text-[11px] text-muted">{layer.source}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {macroFactors.map((factor) => (
          <div key={factor.label} className="rounded-md border border-stroke bg-ink/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{factor.label}</p>
              <span className={`rounded-md border px-2 py-1 text-[11px] ${sentimentTone(factor.impact)}`}>
                {factor.impact}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{factor.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScenarioTable({
  scenarios
}: {
  scenarios: { label: string; estimatedValue: number; estimatedPnL: number }[];
}) {
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <p className="text-sm font-semibold">Szenarioanalyse</p>
      <div className="mt-3 space-y-2">
        {scenarios.map((scenario) => (
          <div key={scenario.label} className="flex items-center justify-between gap-3 rounded-md bg-panel2 px-3 py-2 text-sm">
            <span>{scenario.label}</span>
            <span className="font-mono">{formatCurrency(scenario.estimatedValue)}</span>
            <span className={scenario.estimatedPnL >= 0 ? "font-mono text-profit" : "font-mono text-loss"}>
              {formatCurrency(scenario.estimatedPnL)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
