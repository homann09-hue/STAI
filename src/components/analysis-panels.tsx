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
  AssetScoreEvidence,
  DataQualityReport,
  MacroFactor,
  ProfessionalScores,
  RiskEngineReport,
  ScoreEvidencePoint
} from "@/lib/types";

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

export function EvidenceScoreMeter({
  label,
  value,
  evidence,
  danger
}: {
  label: string;
  value: number | null;
  evidence?: ScoreEvidencePoint;
  danger?: boolean;
}) {
  const available = value !== null && Number.isFinite(value);
  const safeValue = available ? clampScore(value) : 0;
  const status = evidence?.availability === "partial" ? "Teilweise belegt" : available ? "Belegt" : "Nicht belegt";

  return (
    <div className="rounded-md border border-stroke bg-panel p-3" title={evidence?.rationale}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        <p className={available ? "font-mono text-lg font-semibold" : "font-mono text-lg font-semibold text-muted"}>
          {available ? safeValue : "n/a"}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stroke">
        <div
          className={`h-full rounded-full ${danger ? "bg-gradient-to-r from-profit via-amber to-loss" : "bg-gradient-to-r from-loss via-amber to-profit"}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted">
        <span>{status}</span>
        {evidence && evidence.confidence > 0 ? <span>Konfidenz {evidence.confidence}%</span> : null}
      </div>
    </div>
  );
}

export function ProfessionalScoresPanel({
  evidence
}: {
  scores: ProfessionalScores;
  evidence?: AssetScoreEvidence;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EvidenceScoreMeter label="Technical" value={evidence?.dimensions.technical.value ?? null} evidence={evidence?.dimensions.technical} />
        <EvidenceScoreMeter label="Fundamental" value={evidence?.dimensions.fundamental.value ?? null} evidence={evidence?.dimensions.fundamental} />
        <EvidenceScoreMeter label="News" value={evidence?.dimensions.news.value ?? null} evidence={evidence?.dimensions.news} />
        <EvidenceScoreMeter label="Sentiment" value={evidence?.dimensions.news.value ?? null} evidence={evidence?.dimensions.news} />
        <EvidenceScoreMeter label="Momentum" value={evidence?.dimensions.trend.value ?? null} evidence={evidence?.dimensions.trend} />
        <EvidenceScoreMeter label="Volatilitätsrisiko" value={evidence?.dimensions.risk.value ?? null} evidence={evidence?.dimensions.risk} danger />
        <EvidenceScoreMeter label="Liquiditätsrisiko" value={null} danger />
        <EvidenceScoreMeter label="Ereignisrisiko" value={null} danger />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-profit/25 bg-profit/10 p-4">
          <p className="text-sm text-muted">Gesamt-Chancen-Score</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-profit">
            {evidence?.dimensions.total.value === null || evidence?.dimensions.total.value === undefined ? "n/a" : `${evidence.dimensions.total.value}/100`}
          </p>
          <p className="mt-2 text-xs text-muted">
            {evidence?.dimensions.total.value === null || evidence?.dimensions.total.value === undefined
              ? "Nicht genug verifizierte Dimensionen für einen Gesamtwert."
              : scoreLabel(evidence.dimensions.total.value)}
          </p>
        </div>
        <div className="rounded-md border border-loss/25 bg-loss/10 p-4">
          <p className="text-sm text-muted">Gesamt-Risiko-Score</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-loss">
            {evidence?.dimensions.risk.value === null || evidence?.dimensions.risk.value === undefined ? "n/a" : `${evidence.dimensions.risk.value}/100`}
          </p>
          <p className="mt-2 text-xs text-muted">
            {evidence?.dimensions.risk.value === null || evidence?.dimensions.risk.value === undefined
              ? "Kein belegbarer Risikowert verfügbar."
              : "Höherer Wert bedeutet höheres Modellrisiko."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProbabilityPanel({ scores }: { scores: ProfessionalScores }) {
  const up = clampScore(scores.probabilityUp);
  const down = clampScore(scores.probabilityDown);
  const sideways = clampScore(scores.probabilitySideways);

  if (up + down + sideways === 0) {
    return (
      <div className="rounded-md border border-amber/30 bg-amber/10 p-4">
        <p className="text-sm font-semibold text-amber">Modellbasierte Wahrscheinlichkeiten</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Wahrscheinlichkeiten zurückgehalten: Für eine belastbare Schätzung fehlen ausreichend verifizierte Daten.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber/30 bg-amber/10 p-4">
      <p className="text-sm font-semibold text-amber">Modellbasierte Wahrscheinlichkeiten</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted">Steigender Kurs</p>
          <p className="font-mono text-2xl text-profit">{up}%</p>
        </div>
        <div>
          <p className="text-xs text-muted">Fallender Kurs</p>
          <p className="font-mono text-2xl text-loss">{down}%</p>
        </div>
        <div>
          <p className="text-xs text-muted">Seitwärts</p>
          <p className="font-mono text-2xl text-amber">{sideways}%</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-amber">{probabilityDisclaimer}</p>
    </div>
  );
}

export function DataQualityPanel({ quality }: { quality: DataQualityReport }) {
  const confidence = clampScore(quality.confidence);
  const score = clampScore(quality.score);

  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-cyan" />
            <p className="text-sm font-semibold">Datenqualität</p>
          </div>
          <p className="mt-1 text-xs text-muted">
            {quality.sourceLabel}, Vertrauen {confidence}/100, Status {quality.freshness}
          </p>
        </div>
        <p className="font-mono text-2xl font-semibold">{score}</p>
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
  const score = clampScore(report.score);

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
          {score}/100
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
      <p className="text-sm font-semibold">Gleichmäßiger Schock auf das Depot</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        Jede Position bewegt sich hier um denselben Prozentsatz. Das ist eine Rechnung, keine
        Szenarioanalyse: Korrelationen, Beta und Assetklassen bleiben unberücksichtigt. Ein Depot aus
        Anleihen-ETFs und eines aus Kryptowährungen ergeben dieselbe Zeile.
      </p>
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
