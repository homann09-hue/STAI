"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeEuro,
  BrainCircuit,
  Landmark,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  WalletCards
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency, riskTone, scoreLabel, scoreTone } from "@/lib/scoring";
import type { AssetSummary, DashboardData, RiskLevel } from "@/lib/types";

type CapitalProfile = {
  id: string;
  label: string;
  audience: string;
  capital: number;
  deployRate: number;
  maxPositionWeight: number;
  positions: number;
  riskBudget: number;
  tone: string;
  promise: string;
};

const capitalProfiles: CapitalProfile[] = [
  {
    id: "starter",
    label: "1 € Starter",
    audience: "Einsteiger",
    capital: 1,
    deployRate: 0.45,
    maxPositionWeight: 0.34,
    positions: 3,
    riskBudget: 0.03,
    tone: "border-profit/30 bg-profit/10 text-profit",
    promise: "Lernen ohne Überforderung: kleine Beträge, klare Warnungen, keine komplexen Fachwände."
  },
  {
    id: "builder",
    label: "1.000 € Builder",
    audience: "Sparer",
    capital: 1000,
    deployRate: 0.62,
    maxPositionWeight: 0.26,
    positions: 4,
    riskBudget: 0.045,
    tone: "border-cyan/30 bg-cyan/10 text-cyan",
    promise: "Struktur statt Bauchgefühl: Watchlist, Risiko-Caps und nachvollziehbare Scores."
  },
  {
    id: "investor",
    label: "100.000 € Investor",
    audience: "Fortgeschritten",
    capital: 100000,
    deployRate: 0.72,
    maxPositionWeight: 0.18,
    positions: 5,
    riskBudget: 0.06,
    tone: "border-steel/30 bg-steel/10 text-steel",
    promise: "Mehr Kontrolle: Positionsgrößen, Datenqualität, News-Auswirkung und Szenario-Risiken."
  },
  {
    id: "desk",
    label: "10 Mio. € Desk",
    audience: "Profi",
    capital: 10000000,
    deployRate: 0.78,
    maxPositionWeight: 0.12,
    positions: 6,
    riskBudget: 0.075,
    tone: "border-amber/30 bg-amber/10 text-amber",
    promise: "Mandatslogik: Liquidität, Klumpenrisiko, Ereignisrisiko und Governance im Vordergrund."
  },
  {
    id: "institutional",
    label: "1 Mrd. € Mandat",
    audience: "Institutionell",
    capital: 1000000000,
    deployRate: 0.82,
    maxPositionWeight: 0.075,
    positions: 6,
    riskBudget: 0.09,
    tone: "border-mist/25 bg-mist/8 text-mist",
    promise: "Milliarden brauchen Regeln: harte Caps, Audit-Trail, Risk Committee und konservative Sizing-Logik."
  }
];

const riskMultipliers: Record<RiskLevel, number> = {
  niedrig: 1.18,
  mittel: 0.9,
  hoch: 0.55,
  extrem: 0.25
};

function parseCapital(value: string, fallback: number) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function convictionScore(item: AssetSummary) {
  const base = (item.scores.total + item.scores.trend + item.scores.technical + item.scores.news) / 4;
  const quality = item.dataQuality?.score ?? 62;
  const riskDrag = riskMultipliers[item.aiRisk];
  const assetStability = item.asset.type === "etf" ? 1.12 : item.asset.type === "crypto" ? 0.72 : 1;

  return Math.max(4, base * riskDrag * assetStability * (quality / 100));
}

export function CapitalCommandCenter({ data }: { data: DashboardData }) {
  const [profileId, setProfileId] = useState("builder");
  const profile = capitalProfiles.find((item) => item.id === profileId) ?? capitalProfiles[1];
  const [capitalInput, setCapitalInput] = useState(String(profile.capital));
  const [explainMode, setExplainMode] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const model = useMemo(() => {
    const capital = parseCapital(capitalInput, profile.capital);
    const deployable = capital * profile.deployRate;
    const candidates = data.watchlist
      .map((item) => ({
        item,
        conviction: convictionScore(item)
      }))
      .sort((a, b) => b.conviction - a.conviction)
      .slice(0, profile.positions);
    const totalConviction = candidates.reduce((sum, candidate) => sum + candidate.conviction, 0) || 1;
    let deployed = 0;

    const allocations = candidates.map((candidate) => {
      const rawAllocation = (candidate.conviction / totalConviction) * deployable;
      const cap = capital * profile.maxPositionWeight;
      const allocation = Math.min(rawAllocation, cap);
      deployed += allocation;

      return {
        symbol: candidate.item.asset.symbol,
        name: candidate.item.asset.name,
        type: candidate.item.asset.type,
        score: candidate.item.scores.total,
        risk: candidate.item.aiRisk,
        allocation,
        weight: capital ? (allocation / capital) * 100 : 0,
        rationale:
          candidate.item.aiRisk === "hoch" || candidate.item.aiRisk === "extrem"
            ? "Chance vorhanden, aber Modell reduziert automatisch wegen Risiko."
            : candidate.item.asset.type === "etf"
              ? "Stabilitätsanker für breitere Marktteilnahme."
              : "Hoher Score mit kontrollierter Einzelpositionsgröße."
      };
    });

    return {
      capital,
      deployable,
      deployed,
      reserve: Math.max(0, capital - deployed),
      maxSinglePosition: capital * profile.maxPositionWeight,
      riskBudgetValue: capital * profile.riskBudget,
      allocations
    };
  }, [capitalInput, data.watchlist, profile]);

  function selectProfile(nextProfile: CapitalProfile) {
    setProfileId(nextProfile.id);
    setCapitalInput(String(nextProfile.capital));
    setSavedAt(null);
  }

  function savePlan() {
    const payload = {
      profile: profile.label,
      capital: model.capital,
      deployed: model.deployed,
      reserve: model.reserve,
      allocations: model.allocations,
      savedAt: new Date().toISOString()
    };

    window.localStorage.setItem("stockpilot:capital-command-plan", JSON.stringify(payload));
    setSavedAt(
      new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date())
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-cyan/20 bg-[radial-gradient(circle_at_top_left,rgba(120,231,255,0.18),transparent_32%),linear-gradient(145deg,#101712,#050706_58%,#111827)] shadow-panel">
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative border-b border-stroke/70 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="absolute right-4 top-4 hidden rounded-full border border-profit/25 bg-profit/10 px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-profit sm:block">
            Live Modell
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan shadow-glow">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Capital Command Center</p>
              <h2 className="mt-1 text-2xl font-semibold leading-tight text-mist sm:text-3xl">
                Von 1 € bis Milliardenmandat.
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
            Ein Modus für jede Depotgröße: StockPilot passt Erklärung, Positionsgrößen, Risiko-Caps
            und nächste Schritte an dein Kapitalprofil an. Keine Anlageberatung, sondern ein
            transparentes Arbeitsmodell.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5 lg:grid-cols-1 xl:grid-cols-5">
            {capitalProfiles.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProfile(item)}
                className={`rounded-2xl border p-3 text-left transition ${
                  item.id === profile.id
                    ? item.tone
                    : "border-stroke bg-panel/70 text-muted hover:border-cyan/35 hover:text-mist"
                }`}
              >
                <span className="block text-[11px] font-semibold">{item.audience}</span>
                <span className="mt-1 block text-sm font-semibold">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-stroke bg-ink/45 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-muted" htmlFor="capital-input">
              Kapital simulieren
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="capital-input"
                inputMode="decimal"
                value={capitalInput}
                onChange={(event) => setCapitalInput(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-xl border border-stroke bg-coal px-4 font-mono text-xl text-mist outline-none transition focus:border-cyan"
                aria-label="Kapitalbetrag"
              />
              <button
                type="button"
                onClick={() => setExplainMode((current) => !current)}
                className="grid h-12 w-12 place-items-center rounded-xl border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan"
                aria-label={explainMode ? "Profi-Ansicht aktivieren" : "Einsteiger-Erklärung aktivieren"}
                title={explainMode ? "Profi-Ansicht" : "Einsteiger-Erklärung"}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{profile.promise}</p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
              <WalletCards className="h-5 w-5 text-cyan" />
              <p className="mt-3 text-xs text-muted">Kapitalbasis</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{compactMoney(model.capital)}</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
              <Target className="h-5 w-5 text-profit" />
              <p className="mt-3 text-xs text-muted">Modell investiert</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-profit">{compactMoney(model.deployed)}</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
              <ShieldCheck className="h-5 w-5 text-amber" />
              <p className="mt-3 text-xs text-muted">Risikobudget</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-amber">{compactMoney(model.riskBudgetValue)}</p>
            </div>
            <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
              <Scale className="h-5 w-5 text-steel" />
              <p className="mt-3 text-xs text-muted">Max. Einzelposition</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-steel">{compactMoney(model.maxSinglePosition)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Smart Sizing nach Score und Risiko</p>
                  <p className="mt-1 text-xs text-muted">
                    Automatisch kleiner bei hohem Risiko, größer bei Qualität und Stabilität.
                  </p>
                </div>
                <BadgeEuro className="h-5 w-5 text-profit" />
              </div>

              <div className="mt-4 space-y-3">
                {model.allocations.map((allocation) => (
                  <Link
                    key={allocation.symbol}
                    href={`/assets/${encodeURIComponent(allocation.symbol)}`}
                    className="block rounded-2xl border border-stroke bg-ink/45 p-3 transition hover:border-cyan/40 hover:bg-panel2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{allocation.symbol}</p>
                          <span className="rounded-md bg-panel2 px-2 py-1 text-[10px] uppercase tracking-wide text-muted">
                            {allocation.type}
                          </span>
                          <span className={`rounded-md border px-2 py-1 text-[10px] ${riskTone(allocation.risk)}`}>
                            Risiko {allocation.risk}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">{allocation.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-semibold">{compactMoney(allocation.allocation)}</p>
                        <p className="text-xs text-muted">{allocation.weight.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stroke">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan via-profit to-amber"
                        style={{ width: `${Math.min(100, allocation.weight * 4)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className={`text-xs ${scoreTone(allocation.score)}`}>
                        Score {allocation.score}: {scoreLabel(allocation.score)}
                      </p>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">{allocation.rationale}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber" />
                  <p className="text-sm font-semibold">
                    {explainMode ? "Einsteiger-Erklärung" : "Profi-Governance"}
                  </p>
                </div>
                {explainMode ? (
                  <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
                    <p>
                      Das Modell verteilt nicht blind alles. Ein Teil bleibt Reserve, weil Märkte
                      kippen können und Mock-Daten keine echten Orders auslösen dürfen.
                    </p>
                    <p>
                      Je höher Risiko und Unsicherheit, desto kleiner wird die simulierte Position.
                      So lernst du Chancen zu prüfen, ohne Risiko zu romantisieren.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 text-xs text-muted">
                    <p className="rounded-xl bg-ink/50 p-3">
                      Deploy Rate: {(profile.deployRate * 100).toFixed(0)}%, Reserve: {compactMoney(model.reserve)}
                    </p>
                    <p className="rounded-xl bg-ink/50 p-3">
                      Position Cap: {(profile.maxPositionWeight * 100).toFixed(1)}%, Risiko-Budget: {(profile.riskBudget * 100).toFixed(1)}%
                    </p>
                    <p className="rounded-xl bg-ink/50 p-3">
                      Regel: Datenqualität, Risiko-Level und Asset-Klasse verändern die Gewichtung vor dem Ranking.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-stroke bg-panel/75 p-4">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-cyan" />
                  <p className="text-sm font-semibold">Nächste sinnvolle Aktionen</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {[
                    "Watchlist prüfen und nur verständliche Assets öffnen.",
                    "Alerts für Risiko, RSI und News setzen, bevor Kapital erhöht wird.",
                    "Portfolio-Gewichtung kontrollieren und Klumpenrisiko vermeiden."
                  ].map((action) => (
                    <p key={action} className="rounded-xl border border-stroke bg-ink/45 p-3 text-xs leading-5 text-muted">
                      {action}
                    </p>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href="/alerts"
                    className="rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-3 text-center text-sm font-semibold text-cyan transition hover:bg-cyan/15"
                  >
                    Alerts bauen
                  </Link>
                  <Link
                    href="/portfolio"
                    className="rounded-xl border border-profit/30 bg-profit/10 px-3 py-3 text-center text-sm font-semibold text-profit transition hover:bg-profit/15"
                  >
                    Portfolio prüfen
                  </Link>
                </div>
              </div>

              <button
                type="button"
                onClick={savePlan}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mist font-semibold text-ink transition hover:bg-white"
              >
                <ShieldCheck className="h-4 w-4" />
                Plan lokal merken
              </button>
              <p className="text-center text-xs text-muted">
                {savedAt ? `Plan gespeichert um ${savedAt}.` : "Speichert nur lokal auf diesem Gerät."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
