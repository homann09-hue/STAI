"use client";

import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, BriefcaseBusiness, Building2, Coins, Gauge, Layers3, Newspaper, Scale, Search, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCompact, formatCurrency, formatPercent, riskTone } from "@/lib/scoring";
import { formatGermanDateTime } from "@/lib/date-time";
import { scoreValue } from "@/lib/analysis/evidence-scores";
import type { ProviderOperationalStatus, PublicProviderCapabilityReport } from "@/lib/provider-health";
import type {
  CryptoProfessionalProfile,
  ETFProfessionalProfile,
  EquityFundamentalsProfile,
  MarketDataQuality,
  ProfessionalDataPoint,
  ProfessionalMarketReport,
  ProfessionalScreenerRow
} from "@/lib/types";

type Mode = "overview" | "stocks" | "etfs" | "crypto" | "news" | "risk" | "compare";
type NewsImpactFilter = "all" | "positive" | "negative" | "neutral";

const newsQualityFilters: Array<MarketDataQuality | "all"> = ["all", "realtime", "near_realtime", "delayed", "mock", "unavailable"];
const MAX_PROFESSIONAL_TABLE_ROWS = 80;
const MAX_CARD_GRID_ITEMS = 32;
const MAX_WEIGHT_ROWS = 12;
const MAX_NEWS_ROWS = 60;
const MAX_PROVIDER_BADGES = 8;
const MAX_COMPARISON_ROWS = 12;
const MAX_REBALANCING_ITEMS = 8;
const MAX_FOCUS_CHOICES = 12;
const knownQualities: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];
const providerStatusTone: Record<ProviderOperationalStatus, string> = {
  ready: "border-profit/30 bg-profit/10 text-profit",
  configured: "border-cyan/30 bg-cyan/10 text-cyan",
  degraded: "border-amber/30 bg-amber/10 text-amber",
  missing_key: "border-loss/30 bg-loss/10 text-loss",
  license_required: "border-amber/30 bg-amber/10 text-amber",
  demo: "border-steel/30 bg-steel/10 text-steel"
};
const liveClaimLabels: Record<"allowed" | "limited" | "blocked", string> = {
  allowed: "Live zulässig",
  limited: "Near/limitiert",
  blocked: "Nicht als Live"
};

const modeCopy: Record<Mode, { eyebrow: string; title: string; subtitle: string }> = {
  overview: {
    eyebrow: "Global Market Overview",
    title: "Profi-Datenzentrum für Märkte, ETFs, Krypto und Risiko",
    subtitle: "Live/Near-Realtime-Quotes werden getrennt von Mock-, Cache- und vorbereiteten Profi-Daten angezeigt."
  },
  stocks: {
    eyebrow: "Aktien-Screener",
    title: "Fundamentaldaten, Analystenfelder und Kursdaten mit Status",
    subtitle: "Kurse kommen vom aktiven Anbieter, tiefe Fundamentals sind klar als Mock oder vorbereitet gekennzeichnet."
  },
  etfs: {
    eyebrow: "ETF-Screener",
    title: "ETF-Struktur wie bei BlackRock, Vanguard und Morningstar",
    subtitle: "Holdings, Sektoren, TER, Tracking, Risiko und Performance mit Datenqualität je Feld."
  },
  crypto: {
    eyebrow: "Krypto-Screener",
    title: "Krypto-Daten mit Providerstatus für Bid/Ask/Spread",
    subtitle: "Binance/Coinbase können kostenlose Krypto-Quotes liefern; On-Chain/Funding/Open Interest bleiben vorbereitet."
  },
  news: {
    eyebrow: "News-Terminal",
    title: "News, Events und KI-Relevanzbewertung",
    subtitle: "News werden nicht ungeprüft als Fakt verkauft und tragen Datenqualität, Quelle und Impact."
  },
  risk: {
    eyebrow: "Risiko-Dashboard",
    title: "Portfolio-, Konzentrations- und Datenrisiken",
    subtitle: "Risiko-Signale, Rebalancing-Ideen und Szenarien ohne Kauf-/Verkaufsgarantie."
  },
  compare: {
    eyebrow: "Vergleichsseite",
    title: "Asset vs Benchmark, ETF vs ETF, Portfolio vs Index",
    subtitle: "Vergleiche sind vorbereitet und werden mit echten Zeitreihen ausbaubar."
  }
};

function qualityTone(quality: MarketDataQuality) {
  const tones: Record<MarketDataQuality, string> = {
    realtime: "border-profit/35 bg-profit/10 text-profit",
    near_realtime: "border-cyan/35 bg-cyan/10 text-cyan",
    delayed: "border-amber/35 bg-amber/10 text-amber",
    historical: "border-amber/35 bg-amber/10 text-amber",
    mock: "border-loss/35 bg-loss/10 text-loss",
    unavailable: "border-stroke bg-panel text-muted"
  };
  return tones[normalizeQuality(quality)];
}

function normalizeQuality(value: MarketDataQuality | undefined): MarketDataQuality {
  return knownQualities.includes(value as MarketDataQuality) ? (value as MarketDataQuality) : "unavailable";
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function safeText(value: string | undefined, fallback = "nicht verfügbar", maxLength = 120) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function safeSymbol(value: string | undefined) {
  const normalized = safeText(value, "UNKNOWN", 32).replace(/[^A-Z0-9._:-]/gi, "").slice(0, 24);
  return normalized || "UNKNOWN";
}

function takeSafe<T>(items: readonly T[] | undefined, limit: number) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

function safePercentValue(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value as number)) : 0;
}

function formatOptionalCurrency(value: number | undefined, currency: string | undefined) {
  return Number.isFinite(value) ? formatCurrency(value as number, safeText(currency, "USD", 8)) : "nicht geliefert";
}

function formatOptionalCompact(value: number | undefined) {
  return Number.isFinite(value) ? formatCompact(value as number) : "nicht geliefert";
}

function formatReportTimestamp(value: string) {
  return formatGermanDateTime(value);
}

function formatValue(point: ProfessionalDataPoint) {
  if (point.value === null || point.value === undefined) return "nicht geliefert";
  if (typeof point.value === "number") {
    if (!Number.isFinite(point.value)) return "nicht geliefert";
    if (point.unit === "%") return formatPercent(point.value);
    if (Math.abs(point.value) >= 1_000_000) return formatCompact(point.value);
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(point.value);
  }
  return safeText(String(point.value), "nicht geliefert", 180);
}

function collectReportRows(report: ProfessionalMarketReport) {
  const bySymbol = new Map<string, ProfessionalScreenerRow>();
  [
    ...report.equityScreener,
    ...report.etfScreener,
    ...report.cryptoScreener,
    ...report.watchlist,
    ...report.topGainers,
    ...report.topLosers,
    ...report.mostActive
  ].forEach((row) => {
    bySymbol.set(safeSymbol(row.asset.symbol), row);
  });

  return [...bySymbol.values()];
}

function formatRatio(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function QualityPill({ quality }: { quality: MarketDataQuality }) {
  const safeQuality = normalizeQuality(quality);
  const label = safeQuality === "near_realtime" ? "NEAR_REALTIME" : safeQuality.toUpperCase();
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${qualityTone(safeQuality)}`}>{label}</span>;
}

function DataPointCard({ point }: { point: ProfessionalDataPoint }) {
  return (
    <article className="rounded-2xl border border-stroke bg-panel/74 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{safeText(point.label, "Kennzahl", 80)}</p>
        <QualityPill quality={point.quality} />
      </div>
      <p className="mt-3 break-words font-mono text-xl font-semibold text-mist">{formatValue(point)}</p>
      <p className="mt-2 text-xs leading-5 text-muted">Provider: {safeText(point.provider)}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{safeText(point.note, "Keine Zusatznotiz vorhanden.", 220)}</p>
    </article>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "cyan"
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "cyan" | "profit" | "amber" | "loss";
}) {
  const toneClass = {
    cyan: "border-cyan/25 bg-cyan/10 text-cyan",
    profit: "border-profit/25 bg-profit/10 text-profit",
    amber: "border-amber/25 bg-amber/10 text-amber",
    loss: "border-loss/25 bg-loss/10 text-loss"
  }[tone];

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold text-mist">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </article>
  );
}

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: typeof Activity }) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-coal/50 p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyan" />
        <h2 className="text-xl font-semibold text-mist">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MarketPulsePanel({ report, rows }: { report: ProfessionalMarketReport; rows: ProfessionalScreenerRow[] }) {
  const liveLike = rows.filter((row) => row.quote.quality === "realtime" || row.quote.quality === "near_realtime").length;
  const blockedAnalysis = rows.filter((row) => row.dataQuality && !row.dataQuality.sufficientForAnalysis).length;
  const assetClasses = new Set(rows.map((row) => row.asset.type)).size;
  const verifiedScores = rows
    .map((row) => scoreValue(row, "total"))
    .filter((value): value is number => value !== null);
  const averageScore = verifiedScores.length > 0
    ? Math.round(verifiedScores.reduce((sum, value) => sum + value, 0) / verifiedScores.length)
    : null;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Instrumente"
        value={rows.length}
        note="Aktive, provider-normalisierte Assets im aktuellen Profi-Report."
        tone="cyan"
      />
      <MetricCard
        label="Live/Near"
        value={`${liveLike}/${rows.length}`}
        note={`${formatRatio(liveLike, rows.length)} der Kurszeilen sind realtime oder near-realtime markiert.`}
        tone={liveLike ? "profit" : "amber"}
      />
      <MetricCard
        label="Assetklassen"
        value={assetClasses}
        note="Aktien, ETFs, Krypto und weitere Klassen werden getrennt geführt."
        tone="cyan"
      />
      <MetricCard
        label="Analyse-Guard"
        value={blockedAnalysis}
        note={blockedAnalysis ? "Zeilen mit unvollständiger Datenbasis werden blockiert/abgestuft." : "Keine blockierten Analysezeilen im aktuellen Report."}
        tone={blockedAnalysis ? "amber" : "profit"}
      />
      <div className="rounded-2xl border border-stroke bg-panel/72 p-4 md:col-span-2 xl:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Score- und Qualitätslage</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Durchschnittlicher Gesamt-Score {averageScore === null ? "n/a" : `${averageScore}/100`}. Qualität: {report.qualitySummary.realtime} realtime,
              {" "}{report.qualitySummary.nearRealtime} near-realtime, {report.qualitySummary.delayed} verzögert/historisch,
              {" "}{report.qualitySummary.mock} mock, {report.qualitySummary.unavailable} nicht verfügbar.
            </p>
          </div>
          <Link href="/screener" className="rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/15">
            Globales Universum öffnen
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProviderCapabilityPanel({ capabilities }: { capabilities: PublicProviderCapabilityReport }) {
  return (
    <Section title="Provider- und Datenrechte-Cockpit" icon={ShieldAlert}>
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-cyan/25 bg-cyan/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Daten-Readiness</p>
          <p className="mt-3 font-mono text-4xl font-semibold text-mist">{capabilities.readinessScore}/100</p>
          <p className="mt-2 text-sm leading-6 text-muted">{capabilities.publicNotice}</p>
          <p className="mt-3 text-xs text-muted">Aktualisiert: {formatReportTimestamp(capabilities.generatedAt)}</p>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4">
          <p className="text-sm font-semibold text-amber">Warum fehlen noch Daten?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {takeSafe(capabilities.criticalLimitations, 6).map((item) => (
              <p key={item} className="rounded-xl border border-amber/20 bg-coal/45 px-3 py-2 text-xs leading-5 text-muted">
                {safeText(item, "Limitierung ohne Detail", 180)}
              </p>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.9fr_0.7fr_0.7fr_0.7fr_1.35fr_1.35fr] gap-3 border-b border-stroke bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted xl:grid">
          <span>Datenbereich</span>
          <span>Status</span>
          <span>Qualität</span>
          <span>Live-Claim</span>
          <span>Fähigkeiten</span>
          <span>Nächster Schritt</span>
        </div>
        <div className="divide-y divide-stroke">
          {capabilities.categories.map((category) => (
            <article key={category.id} className="grid gap-3 bg-panel/55 px-4 py-4 xl:grid-cols-[0.9fr_0.7fr_0.7fr_0.7fr_1.35fr_1.35fr] xl:items-start">
              <div>
                <p className="font-semibold text-mist">{category.label}</p>
                <p className="mt-1 text-xs text-muted">{category.configuredCount}/{category.totalCount} Quelle(n) konfiguriert · {category.readinessScore}/100</p>
              </div>
              <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${providerStatusTone[category.status]}`}>
                {category.status}
              </span>
              <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${category.quality === "cached" || category.quality === "not_applicable" ? "border-stroke bg-coal text-muted" : qualityTone(category.quality)}`}>
                {category.quality === "not_applicable" ? "n/a" : String(category.quality).toUpperCase()}
              </span>
              <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                category.liveClaim === "allowed" ? "border-profit/30 bg-profit/10 text-profit" : category.liveClaim === "limited" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-amber/30 bg-amber/10 text-amber"
              }`}>
                {liveClaimLabels[category.liveClaim]}
              </span>
              <p className="text-sm leading-6 text-muted">{safeText(category.capabilities.join(", "), "Keine Capability aktiv", 240)}</p>
              <p className="text-sm leading-6 text-muted">{safeText(category.nextAction || category.userImpact, "Keine Aktion hinterlegt", 240)}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-stroke bg-coal/70 p-4">
        <p className="text-sm font-semibold text-mist">Operative nächste Schritte</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {takeSafe(capabilities.nextActions, 5).map((item) => (
            <p key={item} className="rounded-xl border border-stroke bg-panel/70 px-3 py-2 text-xs leading-5 text-muted">
              {safeText(item, "Nächster Schritt fehlt", 180)}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CoverageMatrix({ rows }: { rows: ProfessionalScreenerRow[] }) {
  const assetClasses = [...new Set(rows.map((row) => row.asset.type))].sort();

  return (
    <Section title="Datenabdeckung nach Assetklasse" icon={Layers3}>
      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[1fr_repeat(6,0.85fr)] gap-3 border-b border-stroke bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted lg:grid">
          <span>Assetklasse</span>
          {knownQualities.map((quality) => <span key={quality}>{quality === "near_realtime" ? "near" : quality}</span>)}
        </div>
        <div className="divide-y divide-stroke">
          {assetClasses.map((assetClass) => {
            const classRows = rows.filter((row) => row.asset.type === assetClass);

            return (
              <div key={assetClass} className="grid gap-3 bg-panel/55 px-4 py-4 lg:grid-cols-[1fr_repeat(6,0.85fr)] lg:items-center">
                <div>
                  <p className="font-semibold uppercase tracking-[0.12em] text-mist">{assetClass}</p>
                  <p className="text-xs text-muted">{classRows.length} Instrumente</p>
                </div>
                {knownQualities.map((quality) => {
                  const count = classRows.filter((row) => row.quote.quality === quality).length;

                  return (
                    <div key={quality} className="flex items-center justify-between gap-2 lg:block">
                      <span className="text-xs text-muted lg:hidden">{quality}</span>
                      <span className={`inline-flex min-w-12 justify-center rounded-xl border px-3 py-2 font-mono text-sm ${count ? qualityTone(quality) : "border-stroke bg-coal text-muted"}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-amber">
        Wichtig: Eine hohe Abdeckung bedeutet nicht automatisch belastbare Analyse. Jede Zeile bleibt an Provider, Zeitstempel, Lizenz und Datenqualität gebunden.
      </p>
    </Section>
  );
}

function MarketMoverRail({ title, rows, icon: Icon }: { title: string; rows: ProfessionalScreenerRow[]; icon: typeof TrendingUp }) {
  return (
    <section className="rounded-[2rem] border border-stroke bg-coal/50 p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyan" />
        <h2 className="text-lg font-semibold text-mist">{title}</h2>
      </div>
      <div className="space-y-2">
        {takeSafe(rows, 6).map((row, index) => {
          const symbol = safeSymbol(row.asset.symbol);
          const positive = row.quote.changePercent >= 0;

          return (
            <Link key={`${title}-${symbol}-${index}`} href={`/assets/${encodeURIComponent(symbol)}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border border-stroke bg-panel/64 p-3 transition hover:border-cyan/35 hover:bg-panel2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-coal font-mono text-xs text-muted">{index + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono font-semibold text-mist">{symbol}</p>
                  <QualityPill quality={row.quote.quality} />
                </div>
                <p className="truncate text-xs text-muted">{safeText(row.asset.name, "Asset", 120)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatOptionalCurrency(row.quote.price, row.quote.currency)}</p>
                <p className={positive ? "text-xs text-profit" : "text-xs text-loss"}>{formatPercent(row.quote.changePercent)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FocusPicker({
  rows,
  selectedSymbol,
  onSelect
}: {
  rows: ProfessionalScreenerRow[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Asset auswählen">
      {takeSafe(rows, MAX_FOCUS_CHOICES).map((row) => {
        const symbol = safeSymbol(row.asset.symbol);
        const active = symbol === selectedSymbol;

        return (
          <button
            key={symbol}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(symbol)}
            className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
              active ? "border-cyan/45 bg-cyan/12 text-cyan" : "border-stroke bg-panel text-muted hover:border-cyan/30 hover:text-mist"
            }`}
          >
            <span className="block font-mono text-sm font-semibold">{symbol}</span>
            <span className="mt-1 block max-w-32 truncate text-xs">{safeText(row.asset.name, "Asset", 80)}</span>
          </button>
        );
      })}
    </div>
  );
}

function FundamentalsWorkbench({ rows }: { rows: ProfessionalScreenerRow[] }) {
  const usableRows = rows.filter((row) => row.equityFundamentals);
  const [selectedSymbol, setSelectedSymbol] = useState(safeSymbol(usableRows[0]?.asset.symbol));
  const selected = usableRows.find((row) => safeSymbol(row.asset.symbol) === selectedSymbol) ?? usableRows[0];

  if (!selected?.equityFundamentals) return null;

  return (
    <Section title="Fundamental-Workbench" icon={Building2}>
      <FocusPicker rows={usableRows} selectedSymbol={safeSymbol(selected.asset.symbol)} onSelect={setSelectedSymbol} />
      <EquityFundamentalsGrid profile={selected.equityFundamentals} />
    </Section>
  );
}

function ETFWorkbench({ rows }: { rows: ProfessionalScreenerRow[] }) {
  const usableRows = rows.filter((row) => row.etfProfile);
  const [selectedSymbol, setSelectedSymbol] = useState(safeSymbol(usableRows[0]?.asset.symbol));
  const selected = usableRows.find((row) => safeSymbol(row.asset.symbol) === selectedSymbol) ?? usableRows[0];

  if (!selected?.etfProfile) return null;

  return (
    <Section title="ETF-Struktur-Workbench" icon={Scale}>
      <FocusPicker rows={usableRows} selectedSymbol={safeSymbol(selected.asset.symbol)} onSelect={setSelectedSymbol} />
      <ETFProfileGrid profile={selected.etfProfile} />
    </Section>
  );
}

function CryptoWorkbench({ rows }: { rows: ProfessionalScreenerRow[] }) {
  const usableRows = rows.filter((row) => row.cryptoProfile);
  const [selectedSymbol, setSelectedSymbol] = useState(safeSymbol(usableRows[0]?.asset.symbol));
  const selected = usableRows.find((row) => safeSymbol(row.asset.symbol) === selectedSymbol) ?? usableRows[0];

  if (!selected?.cryptoProfile) return null;

  return (
    <Section title="Krypto-Workbench" icon={Coins}>
      <FocusPicker rows={usableRows} selectedSymbol={safeSymbol(selected.asset.symbol)} onSelect={setSelectedSymbol} />
      <CryptoProfileGrid profile={selected.cryptoProfile} />
    </Section>
  );
}

function ScreenerTable({ rows, title }: { rows: ProfessionalScreenerRow[]; title: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return takeSafe(rows, 500).filter((row) => {
      if (!q) return true;
      return `${safeSymbol(row.asset.symbol)} ${safeText(row.asset.name, "", 120)} ${safeText(row.asset.sector, "", 80)}`.toLowerCase().includes(q);
    });
  }, [query, rows]);
  const visibleRows = filtered.slice(0, MAX_PROFESSIONAL_TABLE_ROWS);
  const hiddenRows = Math.max(0, filtered.length - visibleRows.length);

  return (
    <Section title={title} icon={BarChart3}>
      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 80))}
          placeholder="Symbol, Name oder Branche suchen"
          maxLength={80}
          className="h-11 w-full rounded-2xl border border-stroke bg-panel pl-10 pr-3 text-sm outline-none transition focus:border-cyan/60"
        />
      </label>
      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] gap-3 border-b border-stroke bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted lg:grid">
          <span>Asset</span>
          <span>Kurs</span>
          <span>Bid/Ask</span>
          <span>Spread</span>
          <span>Volumen</span>
          <span>Risiko</span>
          <span>Qualität</span>
        </div>
        <div className="divide-y divide-stroke">
          {visibleRows.map((row, index) => {
            const symbol = safeSymbol(row.asset.symbol);
            const currency = safeText(row.quote.currency, "USD", 8);
            const changePercent = Number.isFinite(row.quote.changePercent) ? row.quote.changePercent : 0;

            return (
            <Link key={`${symbol}-${index}`} href={`/assets/${encodeURIComponent(symbol)}`} className="grid gap-3 bg-panel/55 px-4 py-4 transition hover:bg-panel2 lg:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] lg:items-center">
              <div>
                <p className="font-mono text-lg font-semibold">{symbol}</p>
                <p className="truncate text-sm text-muted">{safeText(row.asset.name, "Unbekanntes Asset", 120)}</p>
                <p className="text-xs text-muted">{safeText(row.asset.exchange, "n/a", 24)} / {safeText(row.asset.currency, currency, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted lg:hidden">Kurs</p>
                <p className="font-mono font-semibold">{formatOptionalCurrency(row.quote.price, currency)}</p>
                <p className={changePercent >= 0 ? "text-xs text-profit" : "text-xs text-loss"}>{formatPercent(changePercent)}</p>
              </div>
              <div className="text-sm text-muted">
                {Number.isFinite(row.quote.bid) && Number.isFinite(row.quote.ask) ? `${formatOptionalCurrency(row.quote.bid, currency)} / ${formatOptionalCurrency(row.quote.ask, currency)}` : "nicht geliefert"}
              </div>
              <div className="text-sm text-muted">{formatOptionalCurrency(row.quote.spread, currency)}</div>
              <div className="font-mono text-sm">{formatOptionalCompact(row.quote.volume)}</div>
              <div><span className={`rounded-md border px-2 py-1 text-xs ${riskTone(row.aiRisk)}`}>{safeText(row.aiRisk, "unklar", 24)}</span></div>
              <div className="space-y-1">
                <QualityPill quality={row.quote.quality} />
                <p className="text-xs text-muted">{safeText(row.quote.provider)}</p>
              </div>
            </Link>
            );
          })}
        </div>
      </div>
      {hiddenRows > 0 ? (
        <p className="mt-3 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-amber" role="status">
          {visibleRows.length} von {filtered.length} Treffern sichtbar. Suche verfeinern, damit große Reports performant bleiben.
        </p>
      ) : null}
    </Section>
  );
}

function EquityFundamentalsGrid({ profile }: { profile: EquityFundamentalsProfile }) {
  const points = [
    profile.revenue,
    profile.netIncome,
    profile.eps,
    profile.peRatio,
    profile.forwardPe,
    profile.pegRatio,
    profile.priceToSales,
    profile.priceToBook,
    profile.ebitda,
    profile.ebitMargin,
    profile.netMargin,
    profile.grossMargin,
    profile.revenueGrowth,
    profile.earningsGrowth,
    profile.debtToEquity,
    profile.operatingCashflow,
    profile.freeCashflow,
    profile.dividendYield,
    profile.payoutRatio,
    profile.buybacks,
    profile.analystConsensus,
    profile.priceTargetMedian,
    profile.earningsDate,
    profile.guidance,
    profile.insiderTransactions,
    profile.institutionalHolders
  ];
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{points.map((item) => <DataPointCard key={item.label} point={item} />)}</div>;
}

function ETFProfileGrid({ profile }: { profile: ETFProfessionalProfile }) {
  const points = [
    profile.isin,
    profile.wkn,
    profile.issuer,
    profile.indexName,
    profile.replicationMethod,
    profile.ter,
    profile.aum,
    profile.distributionPolicy,
    profile.dividendYield,
    profile.distributionInterval,
    profile.trackingDifference,
    profile.trackingError,
    profile.esgScore,
    profile.riskClass,
    profile.volatility,
    profile.sharpeRatio,
    profile.maxDrawdown
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{points.map((item) => <DataPointCard key={item.label} point={item} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-panel/70 p-4">
          <p className="text-sm font-semibold">Top 10 Holdings</p>
          <div className="mt-3 space-y-2">
            {takeSafe(profile.topHoldings, 10).map((holding, index) => (
              <div key={`${safeSymbol(holding.symbol)}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-coal/55 px-3 py-2 text-sm">
                <span>{safeSymbol(holding.symbol)} / {safeText(holding.name, "Unbekannte Position", 80)}</span>
                <span className="font-mono text-cyan">{formatPercent(safePercentValue(holding.weight))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[profile.sectorWeights, profile.countryWeights, profile.currencyWeights, profile.marketCapWeights].map((weights, index) => (
            <div key={index} className="rounded-2xl border border-stroke bg-panel/70 p-4">
              <p className="text-sm font-semibold">{["Sektoren", "Länder", "Währungen", "Marktgewichtung"][index]}</p>
              <div className="mt-3 space-y-2">
                {takeSafe(weights, MAX_WEIGHT_ROWS).map((item, itemIndex) => {
                  const weight = safePercentValue(item.weight);

                  return (
                  <div key={`${safeText(item.label, "Gewichtung", 80)}-${itemIndex}`}>
                    <div className="flex justify-between text-xs text-muted"><span>{safeText(item.label, "Gewichtung", 80)}</span><span>{formatPercent(weight)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stroke"><div className="h-full rounded-full bg-cyan" style={{ width: `${weight}%` }} /></div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CryptoProfileGrid({ profile }: { profile: CryptoProfessionalProfile }) {
  const points = [profile.price, profile.volume24h, profile.marketCap, profile.circulatingSupply, profile.maxSupply, profile.fullyDilutedValuation, profile.dominance, profile.fundingRates, profile.openInterest, profile.onChainData, profile.exchangeData, profile.volatility, profile.trend, profile.events];
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{points.map((item) => <DataPointCard key={item.label} point={item} />)}</div>;
}

function PortfolioPanel({ report }: { report: ProfessionalMarketReport }) {
  const p = report.portfolio;
  return (
    <Section title="Professionelles Portfolio-Dashboard" icon={BriefcaseBusiness}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[p.totalValue, p.dayPnL, p.totalPnL, p.performanceSincePurchase, p.costBasis, p.currencyRisk, p.dividendForecast, p.riskScore, p.volatility, p.drawdown, p.correlations, p.concentrationRisk].map((item) => <DataPointCard key={item.label} point={item} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[p.assetAllocation, p.countryAllocation, p.sectorAllocation].map((weights, index) => (
          <div key={index} className="rounded-2xl border border-stroke bg-panel/70 p-4">
            <p className="text-sm font-semibold">{["Asset Allocation", "Länder-Allokation", "Sektor-Allokation"][index]}</p>
            <div className="mt-3 space-y-2">{takeSafe(weights, MAX_WEIGHT_ROWS).map((item, itemIndex) => <p key={`${safeText(item.label, "Allokation", 80)}-${itemIndex}`} className="flex justify-between text-sm text-muted"><span>{safeText(item.label, "Allokation", 80)}</span><span>{formatPercent(safePercentValue(item.weight))}</span></p>)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm text-amber">
        <p className="font-semibold">Rebalancing-Vorschläge</p>
        <ul className="mt-2 space-y-2">{takeSafe(p.rebalancingSuggestions, MAX_REBALANCING_ITEMS).map((item, index) => <li key={`${safeText(item, "Vorschlag", 80)}-${index}`}>{safeText(item, "Vorschlag aktuell nicht verfügbar.", 180)}</li>)}</ul>
      </div>
    </Section>
  );
}

export function ProfessionalDataView({
  report,
  mode,
  providerCapabilities
}: {
  report: ProfessionalMarketReport;
  mode: Mode;
  providerCapabilities?: PublicProviderCapabilityReport;
}) {
  const copy = modeCopy[mode];
  const [newsQuery, setNewsQuery] = useState("");
  const [newsQuality, setNewsQuality] = useState<MarketDataQuality | "all">("all");
  const [newsImpact, setNewsImpact] = useState<NewsImpactFilter>("all");
  const allRows = useMemo(() => collectReportRows(report), [report]);
  const rankedGainers = useMemo(
    () => takeSafe(report.topGainers.length ? report.topGainers : allRows, 40).sort((a, b) => b.quote.changePercent - a.quote.changePercent),
    [allRows, report.topGainers]
  );
  const rankedLosers = useMemo(
    () => takeSafe(report.topLosers.length ? report.topLosers : allRows, 40).sort((a, b) => a.quote.changePercent - b.quote.changePercent),
    [allRows, report.topLosers]
  );
  const rankedActive = useMemo(
    () => takeSafe(report.mostActive.length ? report.mostActive : allRows, 40).sort((a, b) => (b.quote.volume ?? 0) - (a.quote.volume ?? 0)),
    [allRows, report.mostActive]
  );
  const filteredNews = useMemo(() => {
    const q = newsQuery.trim().toLowerCase();

    return takeSafe(report.newsTerminal, 500).filter((item) => {
      const impact = safeText(item.impact, "", 80).toLowerCase();
      if (newsQuality !== "all" && item.quality !== newsQuality) return false;
      if (newsImpact !== "all" && !impact.includes(newsImpact)) return false;
      if (!q) return true;
      return `${safeText(item.title, "", 160)} ${safeText(item.source, "", 80)} ${safeText(item.category, "", 80)} ${safeText(item.note, "", 240)} ${impact}`.toLowerCase().includes(q);
    });
  }, [newsImpact, newsQuality, newsQuery, report.newsTerminal]);
  const visibleNews = filteredNews.slice(0, MAX_NEWS_ROWS);
  const hiddenNews = Math.max(0, filteredNews.length - visibleNews.length);
  const newsStats = useMemo(() => {
    const sampledNews = takeSafe(report.newsTerminal, 500);
    const mock = sampledNews.filter((item) => item.quality === "mock").length;
    const liveLike = sampledNews.filter((item) => item.quality === "realtime" || item.quality === "near_realtime").length;
    const averageRelevance = sampledNews.reduce((sum, item) => sum + clampScore(item.relevance), 0) / Math.max(1, sampledNews.length);

    return { averageRelevance, liveLike, mock };
  }, [report.newsTerminal]);

  return (
    // `data-testid` traegt hier eine Zusicherung: der E2E-Test prueft, dass
    // dieser Bericht **ohne** Konto nicht im HTML steht. Ohne eine stabile
    // Kennung waere diese Gegenprobe leer und damit wertlos.
    <div className="space-y-6" data-testid="professional-overview">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.16),transparent_34%),linear-gradient(145deg,rgba(9,14,24,0.98),rgba(4,7,12,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan">{copy.eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-mist sm:text-5xl">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">{copy.subtitle}</p>
        <div className="mt-5">
          <MarketPulsePanel report={report} rows={allRows} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {takeSafe(report.providerStack, MAX_PROVIDER_BADGES).map((provider, index) => <span key={`${safeText(provider, "Provider", 80)}-${index}`} className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan">{safeText(provider, "Provider", 80)}</span>)}
          <span className="rounded-xl border border-stroke bg-panel px-3 py-2 text-xs text-muted">Updated {formatReportTimestamp(report.updatedAt)}</span>
        </div>
        {report.qualitySummary.mock > 0 ? (
          <p className="mt-4 rounded-2xl border border-loss/30 bg-loss/10 p-3 text-sm leading-6 text-loss">
            MOCK-Anteil sichtbar: {report.qualitySummary.mock} Datensatz/Datensätze stammen aus Demo- oder vorbereiteten Quellen.
            Daraus werden keine garantierten Investment-Signale abgeleitet.
          </p>
        ) : null}
      </section>

      {mode === "overview" ? (
        <>
          <Section title="Global Market Overview" icon={Activity}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{takeSafe(report.globalOverview, MAX_CARD_GRID_ITEMS).map((item) => <DataPointCard key={item.label} point={item} />)}</div>
          </Section>
          {providerCapabilities ? <ProviderCapabilityPanel capabilities={providerCapabilities} /> : null}
          <CoverageMatrix rows={allRows} />
          <div className="grid gap-4 xl:grid-cols-3">
            <MarketMoverRail title="Top Gewinner" rows={rankedGainers} icon={TrendingUp} />
            <MarketMoverRail title="Top Verlierer" rows={rankedLosers} icon={TrendingDown} />
            <MarketMoverRail title="Most Active" rows={rankedActive} icon={Gauge} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ScreenerTable rows={report.watchlist} title="Watchlist" />
            <Section title="Qualitäts-Summary" icon={ShieldAlert}>
              <div className="grid gap-3 sm:grid-cols-2">
                <DataPointCard point={pointFromSummary("Realtime", report.qualitySummary.realtime)} />
                <DataPointCard point={pointFromSummary("Near-Realtime", report.qualitySummary.nearRealtime)} />
                <DataPointCard point={pointFromSummary("Delayed/Historical", report.qualitySummary.delayed)} />
                <DataPointCard point={pointFromSummary("Mock", report.qualitySummary.mock)} />
              </div>
            </Section>
          </div>
          <PortfolioPanel report={report} />
        </>
      ) : null}

      {mode === "stocks" ? (
        <>
          <ScreenerTable rows={report.equityScreener} title="Aktien-Screener" />
          <FundamentalsWorkbench rows={report.equityScreener} />
        </>
      ) : null}

      {mode === "etfs" ? (
        <>
          <ScreenerTable rows={report.etfScreener} title="ETF-Screener" />
          <ETFWorkbench rows={report.etfScreener} />
        </>
      ) : null}

      {mode === "crypto" ? (
        <>
          <ScreenerTable rows={report.cryptoScreener} title="Krypto-Screener" />
          <CryptoWorkbench rows={report.cryptoScreener} />
        </>
      ) : null}

      {mode === "news" ? (
        <Section title="News & Events mit Quellenstatus" icon={Newspaper}>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <DataPointCard point={{ label: "News im Terminal", value: report.newsTerminal.length, provider: "StockPilot News Layer", quality: report.newsTerminal.length ? "near_realtime" : "unavailable", updatedAt: report.updatedAt, availability: "available", note: "Anzahl der aktuell geladenen Meldungen und Events." }} />
            <DataPointCard point={{ label: "Live/Near-Realtime", value: newsStats.liveLike, provider: "StockPilot Quality Counter", quality: newsStats.liveLike ? "near_realtime" : "unavailable", updatedAt: report.updatedAt, availability: "available", note: "Meldungen mit aktiver oder near-realtime Datenqualität." }} />
            <DataPointCard point={{ label: "Ø Relevanz", value: clampScore(newsStats.averageRelevance), provider: "StockPilot AI Scoring", quality: report.newsTerminal.length ? (newsStats.mock ? "mock" : "near_realtime") : "unavailable", updatedAt: report.updatedAt, availability: "available", note: "Modellbasierte Relevanz, keine Garantie für Kursreaktionen." }} />
          </div>
          <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={newsQuery}
                onChange={(event) => setNewsQuery(event.target.value.slice(0, 100))}
                placeholder="News, Quelle, Kategorie oder Impact suchen"
                className="h-11 w-full rounded-2xl border border-stroke bg-panel pl-10 pr-3 text-sm outline-none transition focus:border-cyan/60"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto" role="group" aria-label="News-Qualität filtern">
              {newsQualityFilters.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  aria-pressed={newsQuality === quality}
                  onClick={() => setNewsQuality(quality)}
                  className={`h-11 shrink-0 rounded-2xl border px-3 text-xs font-semibold transition ${
                    newsQuality === quality ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-stroke bg-panel text-muted hover:text-mist"
                  }`}
                >
                  {quality === "all" ? "Alle" : quality.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto" role="group" aria-label="News-Impact filtern">
              {(["all", "positive", "negative", "neutral"] as NewsImpactFilter[]).map((impact) => (
                <button
                  key={impact}
                  type="button"
                  aria-pressed={newsImpact === impact}
                  onClick={() => setNewsImpact(impact)}
                  className={`h-11 shrink-0 rounded-2xl border px-3 text-xs font-semibold transition ${
                    newsImpact === impact ? "border-profit/40 bg-profit/10 text-profit" : "border-stroke bg-panel text-muted hover:text-mist"
                  }`}
                >
                  {impact === "all" ? "Alle Impacts" : impact}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {visibleNews.length ? visibleNews.map((item) => (
              <article key={item.id} className="rounded-2xl border border-stroke bg-panel/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <QualityPill quality={item.quality} />
                  <span className="rounded-md border border-stroke px-2 py-1 text-xs text-muted">{safeText(item.category, "Kategorie offen", 80)}</span>
                  <span className="text-xs text-muted">{safeText(item.source, "Quelle offen", 80)}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{safeText(item.title, "Nachricht ohne Titel", 160)}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Impact: {safeText(item.impact, "unklar", 80)} / Relevanz {clampScore(item.relevance)}/100. {safeText(item.note, "Keine Zusatznotiz vorhanden.", 220)}</p>
                {item.quality === "mock" ? (
                  <p className="mt-3 rounded-xl border border-loss/25 bg-loss/10 p-3 text-xs leading-5 text-loss">
                    Mock-News: Diese Meldung ist Demo-/Strukturdaten und darf nicht als echte Nachricht interpretiert werden.
                  </p>
                ) : null}
              </article>
            )) : (
              <p className="rounded-2xl border border-stroke bg-panel/70 p-4 text-sm text-muted">
                Keine News für diesen Filter. Filter zurücksetzen oder Datenanbieter prüfen.
              </p>
            )}
            {hiddenNews > 0 ? (
              <p className="rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-amber" role="status">
                {visibleNews.length} von {filteredNews.length} News sichtbar. Suche oder Filter verfeinern, damit das Terminal schnell bleibt.
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {mode === "risk" ? (
        <>
          <Section title="Risiko-Dashboard" icon={AlertTriangle}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{takeSafe(report.riskDashboard, MAX_CARD_GRID_ITEMS).map((item) => <DataPointCard key={item.label} point={item} />)}</div></Section>
          <PortfolioPanel report={report} />
        </>
      ) : null}

      {mode === "compare" ? (
        <Section title="Vergleichsseite" icon={Scale}>
          <div className="grid gap-4 lg:grid-cols-2">{takeSafe(report.comparisons, MAX_COMPARISON_ROWS).map((comparison, index) => <article key={`${safeText(comparison.title, "Vergleich", 80)}-${index}`} className="rounded-2xl border border-stroke bg-panel/70 p-4"><p className="text-sm font-semibold text-cyan">{safeText(comparison.title, "Vergleich", 100)}</p><h2 className="mt-2 text-xl font-semibold">{safeText(comparison.left, "Asset A", 60)} vs {safeText(comparison.right, "Asset B", 60)}</h2><p className="mt-1 text-sm text-muted">Benchmark: {safeText(comparison.benchmark, "nicht verfügbar", 80)}</p><div className="mt-3 grid gap-2">{takeSafe(comparison.points, MAX_CARD_GRID_ITEMS).map((item) => <DataPointCard key={item.label} point={item} />)}</div></article>)}</div>
        </Section>
      ) : null}
    </div>
  );
}

function pointFromSummary(label: string, value: number): ProfessionalDataPoint {
  const safeValue = clampScore(value);
  return {
    label,
    value: safeValue,
    provider: "StockPilot Quality Counter",
    quality: safeValue > 0 && label === "Realtime" ? "realtime" : safeValue > 0 && label === "Near-Realtime" ? "near_realtime" : safeValue > 0 && label === "Mock" ? "mock" : safeValue > 0 ? "delayed" : "unavailable",
    updatedAt: new Date().toISOString(),
    availability: "available",
    note: "Zählt Kursqualitäten im aktuellen Report."
  };
}
