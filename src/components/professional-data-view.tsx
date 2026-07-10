"use client";

import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, BriefcaseBusiness, Building2, Coins, Newspaper, Scale, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCompact, formatCurrency, formatPercent, riskTone } from "@/lib/scoring";
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
const knownQualities: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];

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
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("de-DE") : "nicht verfügbar";
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

export function ProfessionalDataView({ report, mode }: { report: ProfessionalMarketReport; mode: Mode }) {
  const copy = modeCopy[mode];
  const [newsQuery, setNewsQuery] = useState("");
  const [newsQuality, setNewsQuality] = useState<MarketDataQuality | "all">("all");
  const [newsImpact, setNewsImpact] = useState<NewsImpactFilter>("all");
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
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.16),transparent_34%),linear-gradient(145deg,rgba(9,14,24,0.98),rgba(4,7,12,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan">{copy.eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-mist sm:text-5xl">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">{copy.subtitle}</p>
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
          {takeSafe(report.equityScreener, MAX_CARD_GRID_ITEMS).map((row) => row.equityFundamentals ? <Section key={safeSymbol(row.asset.symbol)} title={`${safeSymbol(row.asset.symbol)} Fundamentaldaten`} icon={Building2}><EquityFundamentalsGrid profile={row.equityFundamentals} /></Section> : null)}
        </>
      ) : null}

      {mode === "etfs" ? (
        <>
          <ScreenerTable rows={report.etfScreener} title="ETF-Screener" />
          {takeSafe(report.etfScreener, MAX_CARD_GRID_ITEMS).map((row) => row.etfProfile ? <Section key={safeSymbol(row.asset.symbol)} title={`${safeSymbol(row.asset.symbol)} ETF-Struktur`} icon={Scale}><ETFProfileGrid profile={row.etfProfile} /></Section> : null)}
        </>
      ) : null}

      {mode === "crypto" ? (
        <>
          <ScreenerTable rows={report.cryptoScreener} title="Krypto-Screener" />
          {takeSafe(report.cryptoScreener, MAX_CARD_GRID_ITEMS).map((row) => row.cryptoProfile ? <Section key={safeSymbol(row.asset.symbol)} title={`${safeSymbol(row.asset.symbol)} Krypto-Profil`} icon={Coins}><CryptoProfileGrid profile={row.cryptoProfile} /></Section> : null)}
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
