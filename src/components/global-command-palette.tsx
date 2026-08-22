"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bell, Briefcase, Command, LineChart, Search, Settings2, ShieldAlert, Star, X } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/scoring";
import type { MarketUniverseInstrument, NormalizedQuote } from "@/lib/types";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";

type CommandItem = {
  href: string;
  label: string;
  group: string;
  hint: string;
  keywords: string;
};

const commandItems: CommandItem[] = [
  { href: "/", label: "Dashboard", group: "App", hint: "Marktüberblick, Watchlist, Risiko", keywords: "home dashboard markt watchlist risiko" },
  { href: "/markets", label: "Märkte", group: "Terminal", hint: "Global Market Overview", keywords: "märkte markets global overview dax sp500 nasdaq" },
  { href: "/stocks", label: "Aktien", group: "Terminal", hint: "Aktien-Screener und Fundamentals", keywords: "aktien stocks screener fundamentaldaten" },
  { href: "/etfs", label: "ETFs", group: "Terminal", hint: "ETF-Struktur, Kosten, Holdings", keywords: "etf msci vanguard blackrock ter holdings" },
  { href: "/crypto", label: "Krypto", group: "Terminal", hint: "Binance/Coinbase near-realtime", keywords: "crypto krypto btc eth bitcoin ethereum" },
  { href: "/watchlist", label: "Watchlist", group: "Userdaten", hint: "Cloud/local Watchlist", keywords: "watchlist favoriten cloud supabase" },
  { href: "/portfolio", label: "Portfolio", group: "Userdaten", hint: "Positionen, Risiko, Szenarien", keywords: "portfolio depot allocation performance pnl" },
  { href: "/alerts", label: "Alerts", group: "Automation", hint: "Preis, RSI, News, Earnings", keywords: "alerts alarme rsi preis news earnings" },
  { href: "/news-terminal", label: "News-Terminal", group: "Research", hint: "Quelle, Impact, Sentiment", keywords: "news nachrichten sentiment impact marketaux newsapi" },
  { href: "/risk", label: "Risiko-Dashboard", group: "Risk", hint: "Klumpenrisiko, Drawdown, Datenrisiko", keywords: "risiko risk drawdown volatilität klumpen" },
  { href: "/track-record", label: "Trefferbilanz", group: "Research", hint: "Wie gut waren unsere Prognosen wirklich", keywords: "trefferbilanz track record prognose treffer kalibrierung baseline modellgüte historie" },
  { href: "/compare", label: "Vergleich", group: "Research", hint: "Asset vs Benchmark", keywords: "vergleich compare benchmark asset etf" },
  { href: "/learn", label: "Investieren lernen", group: "Lernen", hint: "Glossar und Beispiel-Portfolios", keywords: "lernen anfänger glossar aktie etf risiko" },
  { href: "/pricing", label: "Pläne", group: "Tarife", hint: "Free, Pro, Premium", keywords: "pricing preis pläne free pro premium billing" },
  { href: "/settings", label: "Einstellungen", group: "Kontrolle", hint: "Provider Health, Supabase, Modus", keywords: "settings einstellungen provider health supabase api keys" },
  { href: "/assets/NVDA", label: "NVDA", group: "Asset", hint: "Nvidia Detailanalyse", keywords: "nvidia nvda aktie ai chip" },
  { href: "/assets/AAPL", label: "AAPL", group: "Asset", hint: "Apple Detailanalyse", keywords: "apple aapl aktie iphone" },
  { href: "/assets/BTC-USD", label: "BTC-USD", group: "Asset", hint: "Bitcoin Detailanalyse", keywords: "bitcoin btc crypto krypto" }
];

const quickActions = [
  { href: "/markets", label: "Märkte", icon: Activity },
  { href: "/stocks", label: "Aktien", icon: BarChart3 },
  { href: "/etfs", label: "ETFs", icon: LineChart },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings2 }
];

const SAFE_ASSET_SYMBOL_PATTERN = /^[A-Z0-9.\-:/]{1,24}$/i;
const MAX_QUERY_CHARS = 80;

function safeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[<>\u0000-\u001F\u007F]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || fallback;
}

function safeSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase();
  return SAFE_ASSET_SYMBOL_PATTERN.test(symbol) ? symbol : null;
}

function safeCanonicalId(value: unknown) {
  if (typeof value !== "string") return null;
  const canonicalId = value.trim().toLowerCase();
  return isCanonicalInstrumentId(canonicalId) ? canonicalId : null;
}

function safeInstrument(value: MarketUniverseInstrument): MarketUniverseInstrument | null {
  const symbol = safeSymbol(value.symbol);
  if (!symbol) return null;
  const canonicalId = safeCanonicalId(value.canonicalId);

  return {
    ...value,
    canonicalId: canonicalId ?? undefined,
    symbol,
    name: safeText(value.name, `${symbol} Asset`, 120),
    exchange: safeText(value.exchange, "Exchange offen", 48),
    provider: safeText(value.provider, "Provider offen", 64),
    assetClass: safeText(value.assetClass, "asset", 24) as MarketUniverseInstrument["assetClass"],
    quoteQuality: safeText(value.quoteQuality, "unavailable", 24) as MarketUniverseInstrument["quoteQuality"],
    matchReasons: Array.isArray(value.matchReasons) ? value.matchReasons.map((item) => safeText(item, "", 80)).filter(Boolean).slice(0, 4) : [],
    analysisReadiness: value.analysisReadiness,
    searchScore: typeof value.searchScore === "number" && Number.isFinite(value.searchScore) ? Math.max(0, Math.min(100, value.searchScore)) : undefined,
    detailHref: canonicalId
      ? `/assets/${encodeURIComponent(symbol)}?canonicalId=${encodeURIComponent(canonicalId)}`
      : safeText(value.detailHref, `/assets/${encodeURIComponent(symbol)}`, 120)
  };
}

/**
 * Treffer aus dem persistierten Instrument Master beziehungsweise aus der
 * Provider-Suche. Bewusst getrennt vom Seed-Universum, damit in der UI sichtbar
 * bleibt, woher ein Instrument stammt und wie belastbar seine Identitaet ist.
 */
type InstrumentSearchHit = {
  canonicalId: string;
  symbol: string;
  name: string;
  assetClass: string;
  exchange: string;
  currency: string;
  provider: string;
  identityConfidence: number;
  resolutionStatus: "resolved" | "ambiguous" | "provider_only" | "invalid";
  resolutionWarnings: string[];
  origin: "instrument_master" | "provider_search";
  quoteStatus: "unknown" | "available" | "restricted" | "error";
};

type InstrumentSearchCoverage = {
  complete: boolean;
  directorySyncAvailable: boolean;
  note: string;
};

/**
 * Kursverfuegbarkeit im aktiven Tarif. `unknown` wird bewusst als "ungeprüft"
 * dargestellt und nie als verfuegbar, damit die Suche nichts verspricht, was
 * die Detailseite nicht halten kann.
 */
function quoteStatusCopy(status: InstrumentSearchHit["quoteStatus"]) {
  if (status === "available") return "Kurs verfügbar";
  if (status === "restricted") return "Kurs im Tarif gesperrt";
  if (status === "error") return "Kurs zuletzt nicht abrufbar";
  return "Kurs ungeprüft";
}

function quoteStatusTone(status: InstrumentSearchHit["quoteStatus"]) {
  if (status === "available") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "restricted") return "border-loss/25 bg-loss/10 text-loss";
  if (status === "error") return "border-amber/25 bg-amber/10 text-amber";
  return "border-stroke bg-coal text-muted";
}

function resolutionCopy(status: InstrumentSearchHit["resolutionStatus"]) {
  if (status === "resolved") return "Identität aufgelöst";
  if (status === "ambiguous") return "Identität mehrdeutig";
  if (status === "invalid") return "Identität ungültig";
  return "Nur providerseitig belegt";
}

function resolutionTone(status: InstrumentSearchHit["resolutionStatus"]) {
  if (status === "resolved") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "ambiguous") return "border-amber/25 bg-amber/10 text-amber";
  if (status === "invalid") return "border-loss/25 bg-loss/10 text-loss";
  return "border-stroke bg-coal text-muted";
}

function readinessCopy(status: MarketUniverseInstrument["analysisReadiness"]) {
  if (status === "ready") return "Analyse bereit";
  if (status === "limited") return "Eingeschränkt";
  if (status === "blocked") return "Blockiert";
  return "Status offen";
}

function readinessTone(status: MarketUniverseInstrument["analysisReadiness"]) {
  if (status === "ready") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "limited") return "border-amber/25 bg-amber/10 text-amber";
  if (status === "blocked") return "border-loss/25 bg-loss/10 text-loss";
  return "border-stroke bg-coal text-muted";
}

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assetResults, setAssetResults] = useState<MarketUniverseInstrument[]>([]);
  const [instrumentHits, setInstrumentHits] = useState<InstrumentSearchHit[]>([]);
  const [instrumentCoverage, setInstrumentCoverage] = useState<InstrumentSearchCoverage | null>(null);
  const [quotes, setQuotes] = useState<Record<string, NormalizedQuote>>({});
  const [assetSearchStatus, setAssetSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commandItems.slice(0, 8);
    return commandItems
      .filter((item) => `${item.label} ${item.group} ${item.hint} ${item.keywords}`.toLowerCase().includes(normalized))
      .slice(0, 10);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setAssetResults([]);
      setInstrumentHits([]);
      setInstrumentCoverage(null);
      setQuotes({});
      setAssetSearchStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const normalized = safeText(query, "", MAX_QUERY_CHARS);
      const params = new URLSearchParams({
        q: normalized,
        limit: normalized ? "8" : "6"
      });

      try {
        setAssetSearchStatus("loading");
        setAssetResults([]);
        setInstrumentHits([]);
        setInstrumentCoverage(null);
        setQuotes({});

        const response = await fetch(`/api/market/universe?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) throw new Error("Universe search failed");

        const payload = (await response.json()) as {
          instruments?: MarketUniverseInstrument[];
          catalogCoverage?: InstrumentSearchCoverage;
          data?: {
            instruments?: MarketUniverseInstrument[];
            catalogCoverage?: InstrumentSearchCoverage;
          };
        };
        if (controller.signal.aborted) return;

        const instruments = (payload.data?.instruments ?? payload.instruments ?? [])
          .map(safeInstrument)
          .filter((item): item is MarketUniverseInstrument => Boolean(item))
          .slice(0, 8);
        setAssetResults(instruments);
        setInstrumentHits([]);
        setInstrumentCoverage(payload.data?.catalogCoverage ?? payload.catalogCoverage ?? null);

        const canonicalIds = instruments
          .map((item) => safeCanonicalId(item.canonicalId))
          .filter((canonicalId): canonicalId is string => Boolean(canonicalId))
          .slice(0, 8);
        const allowedCanonicalIds = new Set(canonicalIds);

        if (canonicalIds.length) {
          const quoteResponse = await fetch(`/api/market/quotes?canonicalIds=${encodeURIComponent(canonicalIds.join(","))}`, {
            cache: "no-store",
            signal: controller.signal
          });

          if (controller.signal.aborted) return;

          if (quoteResponse.ok) {
            const quotePayload = (await quoteResponse.json()) as { quotes?: NormalizedQuote[] };
            if (controller.signal.aborted) return;
            setQuotes(Object.fromEntries((quotePayload.quotes ?? [])
              .filter((quote) => quote.canonicalId && allowedCanonicalIds.has(quote.canonicalId))
              .slice(0, canonicalIds.length)
              .map((quote) => [quote.canonicalId as string, quote])));
          } else {
            setQuotes({});
          }
        } else {
          setQuotes({});
        }

        setAssetSearchStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        setAssetSearchStatus("error");
        setAssetResults([]);
        setQuotes({});
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 items-center gap-2 rounded-xl border border-stroke bg-panel px-3 text-sm font-semibold text-muted transition hover:border-cyan/40 hover:text-cyan lg:inline-flex"
        aria-label="Command Palette öffnen"
      >
        <Command className="h-4 w-4" />
        ⌘K
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Globale Suche">
          <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-[1.5rem] border border-stroke bg-[#07111f] shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 border-b border-stroke p-4">
              <Search className="h-5 w-5 text-cyan" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_CHARS))}
                placeholder="Suche Seite, Asset, Funktion oder Provider..."
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-mist outline-none placeholder:text-muted"
                aria-label="Globale Suche"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted"
                aria-label="Command Palette schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-stroke p-3">
              <div className="flex gap-2 overflow-x-auto">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-stroke bg-panel px-3 text-xs font-semibold text-muted transition hover:border-cyan/40 hover:text-cyan"
                    >
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {assetSearchStatus === "loading" ? (
                <div className="mx-2 mb-2 rounded-2xl border border-stroke bg-panel/60 p-3" role="status" aria-live="polite">
                  <div className="h-3 w-36 animate-pulse rounded-full bg-cyan/25" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded-full bg-white/10" />
                </div>
              ) : null}

              {assetResults.length ? (
                <div className="mb-2 border-b border-stroke pb-2">
                  <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan">Asset-Autocomplete</p>
                  {assetResults.map((item) => {
                    const quote = item.canonicalId ? quotes[item.canonicalId] : undefined;
                    return (
                      <Link
                        key={`${item.symbol}-${item.exchange}`}
                        href={item.detailHref ?? `/assets/${encodeURIComponent(item.symbol)}`}
                        onClick={() => setOpen(false)}
                        className="grid gap-2 rounded-2xl px-4 py-3 transition hover:bg-panel md:grid-cols-[1fr_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono font-semibold text-mist">{item.symbol}</p>
                            <span className="rounded-full border border-stroke bg-coal px-2 py-1 text-[10px] uppercase text-muted">
                              {item.assetClass}
                            </span>
                            <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-1 text-[10px] uppercase text-cyan">
                              {item.quoteQuality}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase ${readinessTone(item.analysisReadiness)}`}>
                              <ShieldAlert className="h-3 w-3" />
                              {readinessCopy(item.analysisReadiness)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted">{item.name}</p>
                          <p className="mt-1 text-xs text-muted">{item.exchange} · {item.provider}</p>
                          {item.matchReasons?.length ? (
                            <p className="mt-1 text-xs text-cyan">Treffer: {item.matchReasons.slice(0, 2).join(", ")} · {item.searchScore ?? 0}/100</p>
                          ) : null}
                        </div>
                        <div className="text-left md:text-right">
                          {quote ? (
                            <>
                              <p className="font-mono text-sm font-semibold text-mist">{formatCurrency(quote.price, quote.currency)}</p>
                              <p className={quote.changePercent >= 0 ? "font-mono text-xs text-profit" : "font-mono text-xs text-loss"}>
                                {formatPercent(quote.changePercent)}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted">Kurs nicht verfügbar</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

              {instrumentHits.length ? (
                <div className="border-t border-stroke/60 pt-2">
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Instrument Master
                  </p>
                  {instrumentHits.map((hit) => (
                    <Link
                      key={hit.canonicalId}
                      href={`/assets/${encodeURIComponent(hit.symbol)}?canonicalId=${encodeURIComponent(hit.canonicalId)}`}
                      onClick={() => setOpen(false)}
                      className="grid gap-1 rounded-2xl px-4 py-3 transition hover:bg-panel"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-mist">{hit.symbol}</span>
                        <span className="rounded-full border border-stroke bg-coal px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          {hit.assetClass}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${resolutionTone(hit.resolutionStatus)}`}
                        >
                          {resolutionCopy(hit.resolutionStatus)} · {hit.identityConfidence}/100
                        </span>
                        <span className="rounded-full border border-stroke bg-coal px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          {hit.origin === "instrument_master" ? "gespeichert" : "neu vom Provider"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${quoteStatusTone(hit.quoteStatus)}`}
                        >
                          {quoteStatusCopy(hit.quoteStatus)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted">{hit.name}</p>
                      <p className="text-xs text-muted">
                        {hit.exchange}
                        {hit.currency ? ` · ${hit.currency}` : ""} · {hit.provider}
                      </p>
                      {hit.resolutionWarnings.length ? (
                        <p className="text-xs text-amber">{hit.resolutionWarnings[0]}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}

              {instrumentCoverage && !instrumentCoverage.complete && (instrumentHits.length || assetResults.length) ? (
                <div
                  className="mx-2 mt-2 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber"
                  role="status"
                >
                  Universum unvollständig: {instrumentCoverage.note}
                </div>
              ) : null}

              {results.length ? results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="grid gap-1 rounded-2xl px-4 py-3 transition hover:bg-panel"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-mist">{item.label}</p>
                    <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase text-cyan">
                      {item.group}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{item.hint}</p>
                </Link>
              )) : !assetResults.length && !instrumentHits.length && assetSearchStatus !== "loading" ? (
                <div className="px-4 py-10 text-center" role="status">
                  <p className="font-semibold text-mist">Kein Treffer.</p>
                  <p className="mt-2 text-sm text-muted">
                    Versuche Symbol, Assetklasse, Provider oder Funktionsname. Fehlende Realtime-Daten werden bewusst nicht erfunden.
                  </p>
                </div>
              ) : null}

              {assetSearchStatus === "error" ? (
                <div className="mx-2 mt-2 rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber" role="status">
                  Asset-Suche momentan nicht erreichbar. Navigation und statische Schnellzugriffe bleiben verfügbar.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
