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

const modeCopy: Record<Mode, { eyebrow: string; title: string; subtitle: string }> = {
  overview: {
    eyebrow: "Global Market Overview",
    title: "Profi-Datenzentrum für Maerkte, ETFs, Krypto und Risiko",
    subtitle: "Live/Near-Realtime-Quotes werden getrennt von Mock-, Cache- und vorbereiteten Profi-Daten angezeigt."
  },
  stocks: {
    eyebrow: "Aktien-Screener",
    title: "Fundamentaldaten, Analysten und Live-Kursdaten",
    subtitle: "Kurse kommen vom aktiven Anbieter, tiefe Fundamentals sind klar als Mock oder vorbereitet gekennzeichnet."
  },
  etfs: {
    eyebrow: "ETF-Screener",
    title: "ETF-Struktur wie bei BlackRock, Vanguard und Morningstar",
    subtitle: "Holdings, Sektoren, TER, Tracking, Risiko und Performance mit Datenqualität je Feld."
  },
  crypto: {
    eyebrow: "Krypto-Screener",
    title: "Near-Realtime Krypto-Daten mit Bid/Ask/Spread",
    subtitle: "Binance/Coinbase koennen kostenlose Krypto-Quotes liefern; On-Chain/Funding/Open Interest bleiben vorbereitet."
  },
  news: {
    eyebrow: "News-Terminal",
    title: "News, Events und KI-Relevanzbewertung",
    subtitle: "News werden nicht ungeprueft als Fakt verkauft und tragen Datenqualität, Quelle und Impact."
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
  return tones[quality];
}

function formatValue(point: ProfessionalDataPoint) {
  if (point.value === null || point.value === undefined) return "nicht geliefert";
  if (typeof point.value === "number") {
    if (point.unit === "%") return formatPercent(point.value);
    if (Math.abs(point.value) >= 1_000_000) return formatCompact(point.value);
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(point.value);
  }
  return point.value;
}

function QualityPill({ quality }: { quality: MarketDataQuality }) {
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${qualityTone(quality)}`}>{quality}</span>;
}

function DataPointCard({ point }: { point: ProfessionalDataPoint }) {
  return (
    <article className="rounded-2xl border border-stroke bg-panel/74 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{point.label}</p>
        <QualityPill quality={point.quality} />
      </div>
      <p className="mt-3 break-words font-mono text-xl font-semibold text-mist">{formatValue(point)}</p>
      <p className="mt-2 text-xs leading-5 text-muted">Provider: {point.provider}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{point.note}</p>
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
    return rows.filter((row) => !q || `${row.asset.symbol} ${row.asset.name} ${row.asset.sector}`.toLowerCase().includes(q));
  }, [query, rows]);

  return (
    <Section title={title} icon={BarChart3}>
      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Symbol, Name oder Branche suchen"
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
          <span>Qualitaet</span>
        </div>
        <div className="divide-y divide-stroke">
          {filtered.map((row) => (
            <Link key={row.asset.symbol} href={`/assets/${encodeURIComponent(row.asset.symbol)}`} className="grid gap-3 bg-panel/55 px-4 py-4 transition hover:bg-panel2 lg:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] lg:items-center">
              <div>
                <p className="font-mono text-lg font-semibold">{row.asset.symbol}</p>
                <p className="truncate text-sm text-muted">{row.asset.name}</p>
                <p className="text-xs text-muted">{row.asset.exchange} / {row.asset.currency}</p>
              </div>
              <div>
                <p className="text-xs text-muted lg:hidden">Kurs</p>
                <p className="font-mono font-semibold">{formatCurrency(row.quote.price, row.quote.currency)}</p>
                <p className={row.quote.changePercent >= 0 ? "text-xs text-profit" : "text-xs text-loss"}>{formatPercent(row.quote.changePercent)}</p>
              </div>
              <div className="text-sm text-muted">
                {row.quote.bid !== undefined && row.quote.ask !== undefined ? `${formatCurrency(row.quote.bid, row.quote.currency)} / ${formatCurrency(row.quote.ask, row.quote.currency)}` : "nicht geliefert"}
              </div>
              <div className="text-sm text-muted">{row.quote.spread !== undefined ? formatCurrency(row.quote.spread, row.quote.currency) : "nicht geliefert"}</div>
              <div className="font-mono text-sm">{row.quote.volume ? formatCompact(row.quote.volume) : "nicht geliefert"}</div>
              <div><span className={`rounded-md border px-2 py-1 text-xs ${riskTone(row.aiRisk)}`}>{row.aiRisk}</span></div>
              <div className="space-y-1">
                <QualityPill quality={row.quote.quality} />
                <p className="text-xs text-muted">{row.quote.provider}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
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
            {profile.topHoldings.map((holding) => (
              <div key={holding.symbol} className="flex items-center justify-between gap-3 rounded-xl bg-coal/55 px-3 py-2 text-sm">
                <span>{holding.symbol} / {holding.name}</span>
                <span className="font-mono text-cyan">{formatPercent(holding.weight)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[profile.sectorWeights, profile.countryWeights, profile.currencyWeights, profile.marketCapWeights].map((weights, index) => (
            <div key={index} className="rounded-2xl border border-stroke bg-panel/70 p-4">
              <p className="text-sm font-semibold">{["Sektoren", "Laender", "Waehrungen", "Marktgewichtung"][index]}</p>
              <div className="mt-3 space-y-2">
                {weights.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-muted"><span>{item.label}</span><span>{formatPercent(item.weight)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stroke"><div className="h-full rounded-full bg-cyan" style={{ width: `${Math.min(100, Math.max(0, item.weight))}%` }} /></div>
                  </div>
                ))}
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
            <p className="text-sm font-semibold">{["Asset Allocation", "Laender-Allokation", "Sektor-Allokation"][index]}</p>
            <div className="mt-3 space-y-2">{weights.map((item) => <p key={item.label} className="flex justify-between text-sm text-muted"><span>{item.label}</span><span>{formatPercent(item.weight)}</span></p>)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm text-amber">
        <p className="font-semibold">Rebalancing-Vorschlaege</p>
        <ul className="mt-2 space-y-2">{p.rebalancingSuggestions.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </Section>
  );
}

export function ProfessionalDataView({ report, mode }: { report: ProfessionalMarketReport; mode: Mode }) {
  const copy = modeCopy[mode];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(120,231,255,0.16),transparent_34%),linear-gradient(145deg,rgba(9,14,24,0.98),rgba(4,7,12,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan">{copy.eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-mist sm:text-5xl">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">{copy.subtitle}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {report.providerStack.map((provider) => <span key={provider} className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan">{provider}</span>)}
          <span className="rounded-xl border border-stroke bg-panel px-3 py-2 text-xs text-muted">Updated {new Date(report.updatedAt).toLocaleString("de-DE")}</span>
        </div>
      </section>

      {mode === "overview" ? (
        <>
          <Section title="Global Market Overview" icon={Activity}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{report.globalOverview.map((item) => <DataPointCard key={item.label} point={item} />)}</div>
          </Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <ScreenerTable rows={report.watchlist} title="Watchlist" />
            <Section title="Qualitaets-Summary" icon={ShieldAlert}>
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
          {report.equityScreener.map((row) => row.equityFundamentals ? <Section key={row.asset.symbol} title={`${row.asset.symbol} Fundamentaldaten`} icon={Building2}><EquityFundamentalsGrid profile={row.equityFundamentals} /></Section> : null)}
        </>
      ) : null}

      {mode === "etfs" ? (
        <>
          <ScreenerTable rows={report.etfScreener} title="ETF-Screener" />
          {report.etfScreener.map((row) => row.etfProfile ? <Section key={row.asset.symbol} title={`${row.asset.symbol} ETF-Struktur`} icon={Scale}><ETFProfileGrid profile={row.etfProfile} /></Section> : null)}
        </>
      ) : null}

      {mode === "crypto" ? (
        <>
          <ScreenerTable rows={report.cryptoScreener} title="Krypto-Screener" />
          {report.cryptoScreener.map((row) => row.cryptoProfile ? <Section key={row.asset.symbol} title={`${row.asset.symbol} Krypto-Profil`} icon={Coins}><CryptoProfileGrid profile={row.cryptoProfile} /></Section> : null)}
        </>
      ) : null}

      {mode === "news" ? (
        <Section title="News & Events near-realtime vorbereitet" icon={Newspaper}>
          <div className="space-y-3">{report.newsTerminal.map((item) => <article key={item.id} className="rounded-2xl border border-stroke bg-panel/70 p-4"><div className="flex flex-wrap items-center gap-2"><QualityPill quality={item.quality} /><span className="rounded-md border border-stroke px-2 py-1 text-xs text-muted">{item.category}</span><span className="text-xs text-muted">{item.source}</span></div><h2 className="mt-3 text-lg font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted">Impact: {item.impact} / Relevanz {item.relevance}/100. {item.note}</p></article>)}</div>
        </Section>
      ) : null}

      {mode === "risk" ? (
        <>
          <Section title="Risiko-Dashboard" icon={AlertTriangle}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{report.riskDashboard.map((item) => <DataPointCard key={item.label} point={item} />)}</div></Section>
          <PortfolioPanel report={report} />
        </>
      ) : null}

      {mode === "compare" ? (
        <Section title="Vergleichsseite" icon={Scale}>
          <div className="grid gap-4 lg:grid-cols-2">{report.comparisons.map((comparison) => <article key={comparison.title} className="rounded-2xl border border-stroke bg-panel/70 p-4"><p className="text-sm font-semibold text-cyan">{comparison.title}</p><h2 className="mt-2 text-xl font-semibold">{comparison.left} vs {comparison.right}</h2><p className="mt-1 text-sm text-muted">Benchmark: {comparison.benchmark}</p><div className="mt-3 grid gap-2">{comparison.points.map((item) => <DataPointCard key={item.label} point={item} />)}</div></article>)}</div>
        </Section>
      ) : null}
    </div>
  );
}

function pointFromSummary(label: string, value: number): ProfessionalDataPoint {
  return {
    label,
    value,
    provider: "StockPilot Quality Counter",
    quality: value > 0 && label === "Mock" ? "mock" : label === "Near-Realtime" ? "near_realtime" : "unavailable",
    updatedAt: new Date().toISOString(),
    availability: "available",
    note: "Zaehlt Kursqualitaeten im aktuellen Report."
  };
}
