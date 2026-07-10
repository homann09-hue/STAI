"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Save } from "lucide-react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";

type SavedAnalysis = {
  id: string;
  symbol: string;
  score: number;
  risk: number;
  news: string;
  createdAt: string;
};

const MAX_SAVED_ANALYSES = 12;
const MAX_SYMBOL_INPUT_LENGTH = 32;
const MAX_SCORE_INPUT_LENGTH = 8;
const MAX_NEWS_LENGTH = 240;

function clampScore(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function cleanSymbol(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 16)
    : "";
}

function cleanText(value: unknown, maxLength: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[<>\u0000-\u001F\u007F]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || fallback;
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function normalizeSavedAnalyses(value: unknown): SavedAnalysis[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_SAVED_ANALYSES)
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<SavedAnalysis>;
      const symbol = cleanSymbol(candidate.symbol);

      if (!symbol) return null;

      return {
        id: cleanText(candidate.id, 120, `analysis-${index}`),
        symbol,
        score: Math.round(clampScore(candidate.score)),
        risk: Math.round(clampScore(candidate.risk)),
        news: cleanText(candidate.news, MAX_NEWS_LENGTH, "Datenlage nicht verfügbar."),
        createdAt: cleanDate(candidate.createdAt)
      };
    })
    .filter((item): item is SavedAnalysis => Boolean(item));
}

function tone(score: number) {
  if (score >= 70) return "text-profit";
  if (score >= 45) return "text-amber";
  return "text-loss";
}

function cleanScoreInput(value: string) {
  return value.replace(/[^0-9.,-]/g, "").slice(0, MAX_SCORE_INPUT_LENGTH);
}

export function AnalysisWorkbench() {
  const [symbol, setSymbol] = useState("NVDA");
  const [score, setScore] = useState("68");
  const [risk, setRisk] = useState("54");
  const [news, setNews] = useState("Starke Nachfrage, hohe Bewertung, Datenqualität prüfen.");
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);

  useEffect(() => {
    setSaved(normalizeSavedAnalyses(readOfflineValue<unknown>(OFFLINE_KEYS.analysisWorkbench)));
  }, []);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.analysisWorkbench, saved);
  }, [saved]);

  const model = useMemo(() => {
    const cleanScore = clampScore(score);
    const cleanRisk = clampScore(risk);
    const rawUp = Math.min(82, Math.max(8, cleanScore * 0.72 + (100 - cleanRisk) * 0.18));
    const rawDown = Math.min(82, Math.max(8, cleanRisk * 0.58 + (100 - cleanScore) * 0.22));
    const rawSideways = Math.max(8, 100 - rawUp - rawDown);
    const totalProbability = rawUp + rawDown + rawSideways;
    const chanceUp = Math.round((rawUp / totalProbability) * 100);
    const chanceDown = Math.round((rawDown / totalProbability) * 100);
    const sideways = Math.max(0, 100 - chanceUp - chanceDown);
    const riskLabel = cleanRisk >= 80 ? "extrem" : cleanRisk >= 60 ? "hoch" : cleanRisk >= 35 ? "mittel" : "niedrig";
    return {
      cleanScore,
      cleanRisk,
      chanceUp,
      chanceDown,
      sideways,
      riskLabel,
      stance: cleanScore >= 70 && cleanRisk < 60 ? "Interessant, aber Datenqualität prüfen" : cleanRisk >= 70 ? "Vorsicht: Risiko zuerst prüfen" : "Beobachten / neutral einordnen"
    };
  }, [risk, score]);

  function saveAnalysis() {
    const normalizedSymbol = cleanSymbol(symbol);
    if (!normalizedSymbol) return;
    setSaved((current) => [
      {
        id: `analysis-${Date.now()}`,
        symbol: normalizedSymbol,
        score: Math.round(model.cleanScore),
        risk: Math.round(model.cleanRisk),
        news: cleanText(news, MAX_NEWS_LENGTH, "Datenlage nicht verfügbar."),
        createdAt: new Date().toISOString()
      },
      ...current.filter((item) => item.symbol !== normalizedSymbol)
    ].slice(0, MAX_SAVED_ANALYSES));
    setSymbol(normalizedSymbol);
    setScore(String(Math.round(model.cleanScore)));
    setRisk(String(Math.round(model.cleanRisk)));
    setNews(cleanText(news, MAX_NEWS_LENGTH, "Datenlage nicht verfügbar."));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.14),transparent_34%),linear-gradient(145deg,rgba(12,19,32,0.98),rgba(5,8,14,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">Analyse Workbench</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-mist sm:text-4xl">
          KI-ähnliche Analyse strukturiert und ehrlich erzeugen
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Diese Workbench ist sofort nutzbar: du gibst Score, Risiko und Nachrichtenlage ein,
          STAI erstellt daraus Bull/Bear/Neutral Case, Wahrscheinlichkeiten und Warnhinweise.
          Es ist eine modellbasierte Schätzung, keine Garantie.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
          <h2 className="text-lg font-semibold text-mist">Eingaben</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-muted">
              Symbol
              <input value={symbol} maxLength={MAX_SYMBOL_INPUT_LENGTH} onChange={(event) => setSymbol(event.target.value.slice(0, MAX_SYMBOL_INPUT_LENGTH))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <label className="text-sm text-muted">
              Gesamt-Score 0-100
              <input value={score} inputMode="numeric" maxLength={MAX_SCORE_INPUT_LENGTH} onChange={(event) => setScore(cleanScoreInput(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <label className="text-sm text-muted">
              Risiko 0-100
              <input value={risk} inputMode="numeric" maxLength={MAX_SCORE_INPUT_LENGTH} onChange={(event) => setRisk(cleanScoreInput(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" />
            </label>
            <label className="text-sm text-muted">
              Nachrichten-/Datenlage
              <textarea value={news} maxLength={MAX_NEWS_LENGTH} onChange={(event) => setNews(event.target.value.slice(0, MAX_NEWS_LENGTH))} className="mt-2 min-h-28 w-full rounded-xl border border-stroke bg-coal px-3 py-3 text-mist outline-none focus:border-cyan" />
            </label>
            <button type="button" onClick={saveAnalysis} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-profit px-4 font-semibold text-ink">
              <Save className="h-4 w-4" />
              Analyse speichern
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-cyan" />
              <h2 className="text-lg font-semibold text-mist">Strukturierte Einschätzung</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              Kurzfazit: <span className="font-semibold text-mist">{model.stance}</span>. Risiko-Level:{" "}
              <span className="font-semibold text-amber">{model.riskLabel}</span>.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
                <p className="text-xs text-muted">Chance steigend</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-profit">{model.chanceUp}%</p>
              </div>
              <div className="rounded-2xl border border-loss/25 bg-loss/10 p-3">
                <p className="text-xs text-muted">Chance fallend</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-loss">{model.chanceDown}%</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-coal p-3">
                <p className="text-xs text-muted">Seitwärts</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-mist">{model.sideways}%</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <article className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
                <h3 className="font-semibold text-profit">Bull Case</h3>
                <p className="mt-2 text-xs leading-5 text-muted">Score, Momentum oder News sprechen für steigendes Interesse, wenn Daten frisch und belastbar sind.</p>
              </article>
              <article className="rounded-2xl border border-loss/25 bg-loss/10 p-3">
                <h3 className="font-semibold text-loss">Bear Case</h3>
                <p className="mt-2 text-xs leading-5 text-muted">Bewertung, Volatilität, Datenlücken oder negative News können die Einschätzung kippen.</p>
              </article>
              <article className="rounded-2xl border border-stroke bg-coal p-3">
                <h3 className="font-semibold text-mist">Neutral Case</h3>
                <p className="mt-2 text-xs leading-5 text-muted">Bei gemischter Lage ist Beobachten sinnvoller als ein hartes Signal.</p>
              </article>
            </div>
            <p className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-amber">
              Modellbasierte Schätzung: Diese Werte sind keine Garantie, keine Anlageberatung und hängen von Datenqualität und Annahmen ab.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
            <h2 className="text-lg font-semibold text-mist">Gespeicherte Analysen</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {saved.length ? saved.map((item) => (
                <article key={item.id} className="rounded-2xl border border-stroke bg-coal/70 p-4">
                  <p className="font-semibold text-mist">{item.symbol}</p>
                  <p className={`mt-2 font-mono text-xl font-semibold ${tone(item.score)}`}>{item.score}/100</p>
                  <p className="mt-2 text-xs leading-5 text-muted">{item.news}</p>
                </article>
              )) : (
                <p className="rounded-2xl border border-stroke bg-coal/70 p-4 text-sm text-muted">Noch keine Analyse gespeichert.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
