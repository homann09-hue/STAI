"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Database, Fingerprint, LockKeyhole, Loader2, Radio, Search, ShieldAlert, Star } from "lucide-react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import type { MarketUniverseAssetClass, MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";

const assetClasses: Array<{ key: MarketUniverseAssetClass | "all"; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "stock", label: "Aktien" },
  { key: "etf", label: "ETFs" },
  { key: "crypto", label: "Krypto" },
  { key: "index", label: "Indizes" },
  { key: "forex", label: "Forex" },
  { key: "commodity", label: "Rohstoffe" },
  { key: "future", label: "Futures" },
  { key: "option", label: "Optionen" }
];

const MAX_VISIBLE_MARKET_ROWS = 80;
type SortKey = "symbol" | "assetClass" | "coverage" | "quality" | "identity";
type PresetKey = "all" | "live" | "momentum" | "income" | "license";
const momentumAssetClasses: MarketUniverseAssetClass[] = ["stock", "crypto", "index"];
const incomeAssetClasses: MarketUniverseAssetClass[] = ["etf", "fund"];

const screenerPresets: Array<{ key: PresetKey; label: string; description: string }> = [
  { key: "all", label: "Alle", description: "Komplettes vorbereitetes Marktuniversum." },
  { key: "live", label: "Live-fähig", description: "Nur wirklich streambare Anbieter, keine vorbereiteten Public-Provider." },
  { key: "momentum", label: "Momentum", description: "Aktien, Krypto und Indizes für Trendprüfung." },
  { key: "income", label: "Income/ETF", description: "ETFs und Fonds für Kosten/Dividenden-Prüfung." },
  { key: "license", label: "Lizenz nötig", description: "Professionelle Feeds, die nicht live gefaked werden." }
];

function normalizeFavorites(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^[A-Z0-9./:-]{1,24}$/.test(item))
    )
  ].slice(0, 60);
}

function normalizeFavoriteSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9./:-]/g, "").slice(0, 24);
}

function coverageTone(coverage: MarketUniverseInstrument["coverage"]) {
  if (coverage === "available") return "border-profit/30 bg-profit/10 text-profit";
  if (coverage === "prepared") return "border-cyan/30 bg-cyan/10 text-cyan";
  if (coverage === "license_required") return "border-amber/30 bg-amber/10 text-amber";
  return "border-loss/30 bg-loss/10 text-loss";
}

function coverageLabel(coverage: MarketUniverseInstrument["coverage"]) {
  if (coverage === "available") return "Daten aktiv";
  if (coverage === "prepared") return "Vorbereitet";
  if (coverage === "license_required") return "Lizenz nötig";
  return "Provider fehlt";
}

function qualityTone(quality: MarketUniverseInstrument["quoteQuality"]) {
  if (quality === "realtime" || quality === "near_realtime") return "border-profit/25 bg-profit/10 text-profit";
  if (quality === "delayed" || quality === "historical") return "border-amber/25 bg-amber/10 text-amber";
  if (quality === "mock") return "border-cyan/25 bg-cyan/10 text-cyan";
  return "border-loss/25 bg-loss/10 text-loss";
}

function qualityLabel(quality: MarketUniverseInstrument["quoteQuality"]) {
  if (quality === "realtime") return "Realtime";
  if (quality === "near_realtime") return "Near-Realtime";
  if (quality === "delayed") return "Delayed";
  if (quality === "historical") return "Historisch";
  if (quality === "mock") return "Mock";
  return "Nicht verfügbar";
}

function resolutionTone(status: MarketUniverseInstrument["resolutionStatus"]) {
  if (status === "resolved") return "border-profit/25 bg-profit/10 text-profit";
  if (status === "provider_only") return "border-cyan/25 bg-cyan/10 text-cyan";
  if (status === "ambiguous") return "border-amber/25 bg-amber/10 text-amber";
  return "border-loss/25 bg-loss/10 text-loss";
}

function resolutionLabel(status: MarketUniverseInstrument["resolutionStatus"]) {
  if (status === "resolved") return "Eindeutig";
  if (status === "provider_only") return "Provider-only";
  if (status === "ambiguous") return "Prüfen";
  return "Nicht nutzbar";
}

export function MarketUniverseExplorer({
  instruments,
  coverage,
  provider,
  disclaimer
}: {
  instruments: MarketUniverseInstrument[];
  coverage: MarketUniverseCoverage[];
  provider?: string;
  disclaimer?: string;
}) {
  const [query, setQuery] = useState("");
  const [assetClass, setAssetClass] = useState<MarketUniverseAssetClass | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [preset, setPreset] = useState<PresetKey>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [remoteInstruments, setRemoteInstruments] = useState<MarketUniverseInstrument[]>(instruments);
  const [remoteProvider, setRemoteProvider] = useState(provider ?? "StockPilot Prepared Universe");
  const [remoteDisclaimer, setRemoteDisclaimer] = useState(disclaimer ?? "");
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setFavorites(normalizeFavorites(readOfflineValue<unknown>(OFFLINE_KEYS.screenerFavorites)));
  }, []);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.screenerFavorites, favorites);
  }, [favorites]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setRemoteInstruments(instruments);
      setRemoteProvider(provider ?? "StockPilot Prepared Universe");
      setRemoteDisclaimer(disclaimer ?? "");
      setSearchStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchStatus("loading");

      try {
        const params = new URLSearchParams({
          q: normalizedQuery,
          assetClass,
          limit: "200"
        });
        const response = await fetch(`/api/market/universe?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        if (!response.ok) throw new Error("Universe search failed");
        const payload = await response.json() as {
          data?: {
            instruments?: MarketUniverseInstrument[];
            provider?: string;
            disclaimer?: string;
          };
        };
        const result = payload.data;

        setRemoteInstruments(Array.isArray(result?.instruments) ? result.instruments : []);
        setRemoteProvider(result?.provider ?? provider ?? "StockPilot Provider Universe");
        setRemoteDisclaimer(result?.disclaimer ?? disclaimer ?? "");
        setSearchStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemoteInstruments(instruments);
        setRemoteProvider(provider ?? "StockPilot Prepared Universe");
        setRemoteDisclaimer("Provider-Suche konnte gerade nicht geladen werden. Lokale Startabdeckung wird weiter angezeigt.");
        setSearchStatus("error");
      }
    }, 260);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [assetClass, disclaimer, instruments, provider, query]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return remoteInstruments.filter((item) => {
      if (assetClass !== "all" && item.assetClass !== assetClass) return false;
      if (favoritesOnly && !favorites.includes(item.symbol)) return false;
      if (preset === "live" && !item.subscribable) return false;
      if (preset === "momentum" && !momentumAssetClasses.includes(item.assetClass)) return false;
      if (preset === "income" && !incomeAssetClasses.includes(item.assetClass)) return false;
      if (preset === "license" && item.coverage !== "license_required") return false;
      if (!normalizedQuery) return true;
      return `${item.symbol} ${item.name} ${item.exchange} ${item.country} ${item.assetClass}`.toLowerCase().includes(normalizedQuery);
    }).sort((a, b) => {
      if (sortKey === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sortKey === "assetClass") return a.assetClass.localeCompare(b.assetClass) || a.symbol.localeCompare(b.symbol);
      if (sortKey === "coverage") return a.coverage.localeCompare(b.coverage) || a.symbol.localeCompare(b.symbol);
      if (sortKey === "identity") return (b.identityConfidence ?? 0) - (a.identityConfidence ?? 0) || a.symbol.localeCompare(b.symbol);
      return a.quoteQuality.localeCompare(b.quoteQuality) || a.symbol.localeCompare(b.symbol);
    });
  }, [assetClass, favorites, favoritesOnly, preset, query, remoteInstruments, sortKey]);
  const visibleResults = filtered.slice(0, MAX_VISIBLE_MARKET_ROWS);
  const hiddenResultCount = Math.max(0, filtered.length - visibleResults.length);

  const stats = {
    available: remoteInstruments.filter((item) => item.coverage === "available").length,
    prepared: remoteInstruments.filter((item) => item.coverage === "prepared").length,
    license: remoteInstruments.filter((item) => item.coverage === "license_required").length,
    subscribable: remoteInstruments.filter((item) => item.subscribable).length,
    resolved: remoteInstruments.filter((item) => item.resolutionStatus === "resolved").length,
    needsReview: remoteInstruments.filter((item) => item.resolutionStatus === "ambiguous" || item.resolutionStatus === "invalid").length
  };

  function toggleFavorite(symbol: string) {
    const normalizedSymbol = normalizeFavoriteSymbol(symbol);
    if (!normalizedSymbol) return;
    setFavorites((current) => current.includes(normalizedSymbol) ? current.filter((item) => item !== normalizedSymbol) : [normalizedSymbol, ...current].slice(0, 60));
  }

  return (
    <section className="space-y-4 rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(88,166,255,0.15),transparent_32%),linear-gradient(145deg,rgba(8,14,24,0.98),rgba(3,7,13,0.98))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">Global Market Universe</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">Alle Assetklassen sauber strukturieren</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Aktien, ETFs, Krypto, Indizes, Forex, Rohstoffe, Futures und Optionen werden als universelles Instrumentenmodell geführt.
            Was nicht lizenziert oder angebunden ist, wird nie als live dargestellt.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-cyan">
              Quelle: {remoteProvider}
            </span>
            {searchStatus === "loading" ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-panel px-3 py-2 text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Provider-Suche läuft
              </span>
            ) : null}
            {searchStatus === "error" ? (
              <span className="rounded-xl border border-loss/25 bg-loss/10 px-3 py-2 text-loss">
                Provider-Suche gestört
              </span>
            ) : null}
          </div>
          {remoteDisclaimer ? (
            <p className="mt-2 max-w-3xl rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
              {remoteDisclaimer}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[28rem]">
          <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
            <Radio className="h-4 w-4 text-profit" />
            <p className="mt-2 font-mono text-xl font-semibold text-profit">{stats.available}</p>
            <p className="text-xs text-muted">{stats.subscribable} bestätigt streambar</p>
          </div>
          <div className="rounded-2xl border border-cyan/25 bg-cyan/10 p-3">
            <Database className="h-4 w-4 text-cyan" />
            <p className="mt-2 font-mono text-xl font-semibold text-cyan">{stats.prepared}</p>
            <p className="text-xs text-muted">vorbereitet</p>
          </div>
          <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3">
            <LockKeyhole className="h-4 w-4 text-amber" />
            <p className="mt-2 font-mono text-xl font-semibold text-amber">{stats.license}</p>
            <p className="text-xs text-muted">Lizenz nötig</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-profit/20 bg-profit/8 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-profit">
            <Fingerprint className="h-4 w-4" />
            Instrument-Master aktiv
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-mist">{stats.resolved}</p>
          <p className="text-xs leading-5 text-muted">Instrumente mit eindeutiger interner Kennung, Börse, Währung und Assetklasse.</p>
        </div>
        <div className="rounded-2xl border border-amber/20 bg-amber/8 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber">
            <ShieldAlert className="h-4 w-4" />
            Prüfung nötig
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-mist">{stats.needsReview}</p>
          <p className="text-xs leading-5 text-muted">Uneindeutige Provider-Symbole, fehlender Handelsplatz oder nicht nutzbare Daten werden sichtbar markiert.</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-sm font-semibold text-mist">Warum das wichtig ist</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Gleiche Ticker können je Börse, Assetklasse oder Währung andere Instrumente bedeuten. STAI trennt diese Fälle,
            statt falsche Live- oder Analyse-Daten zusammenzumischen.
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Globales Marktuniversum durchsuchen</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 80))}
            className="h-12 w-full rounded-2xl border border-stroke bg-coal pl-11 pr-4 text-sm text-mist outline-none transition placeholder:text-muted focus:border-cyan/60"
            placeholder="Suche Symbol, Name, Börse, Land, Assetklasse..."
            maxLength={80}
          />
        </label>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Assetklasse filtern">
          {assetClasses.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={assetClass === item.key}
              aria-label={`Assetklasse ${item.label} anzeigen`}
              onClick={() => setAssetClass(item.key)}
              className={`h-12 shrink-0 rounded-2xl border px-3 text-sm font-semibold transition ${
                assetClass === item.key ? "border-cyan/50 bg-cyan/12 text-cyan" : "border-stroke bg-panel text-muted hover:text-mist"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">
          <Star className="h-3.5 w-3.5 text-amber" />
          {favorites.length} Favoriten
        </span>
        <button
          type="button"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((current) => !current)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
            favoritesOnly ? "border-amber/40 bg-amber/10 text-amber" : "border-stroke bg-panel text-muted hover:text-mist"
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          Nur Favoriten
        </button>
        {screenerPresets.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            title={item.description}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
              preset === item.key ? "border-profit/40 bg-profit/10 text-profit" : "border-stroke bg-panel text-muted hover:text-mist"
            }`}
          >
            Preset: {item.label}
          </button>
        ))}
        {(["symbol", "assetClass", "coverage", "quality", "identity"] as SortKey[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSortKey(item)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
              sortKey === item ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-stroke bg-panel text-muted hover:text-mist"
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort: {item}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm leading-6 text-amber" role="status">
          Keine Treffer für diese Kombination. Prüfe Schreibweise, Assetklasse oder Provider-Status. Es werden keine synthetischen Treffer erzeugt.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.8fr_1.4fr_0.7fr_0.75fr_0.85fr_0.85fr_1fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted xl:grid">
          <span>Symbol</span>
          <span>Name</span>
          <span>Klasse</span>
          <span>Börse</span>
          <span>Identität</span>
          <span>Provider</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-stroke">
          {visibleResults.length > 0 ? visibleResults.map((item) => (
            <article key={item.canonicalId ?? `${item.symbol}-${item.exchange}`} className="grid gap-2 bg-panel/55 px-4 py-4 xl:grid-cols-[0.8fr_1.4fr_0.7fr_0.75fr_0.85fr_0.85fr_1fr] xl:items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(item.symbol)}
                  className={`grid h-10 w-10 place-items-center rounded-xl border ${favorites.includes(item.symbol) ? "border-amber/35 bg-amber/10 text-amber" : "border-stroke text-muted"}`}
                  aria-label={`${item.symbol} Favorit umschalten`}
                >
                  <Star className="h-4 w-4" />
                </button>
                <Link href={`/assets/${encodeURIComponent(item.symbol)}`} className="font-mono text-lg font-semibold text-mist transition hover:text-cyan">
                  {item.symbol}
                </Link>
              </div>
              <div>
                <p className="font-semibold text-mist">{item.name}</p>
                <p className="text-xs text-muted">{item.country} · {item.currency}</p>
              </div>
              <p className="text-sm uppercase tracking-[0.14em] text-muted">{item.assetClass}</p>
              <p className="text-sm text-muted">{item.exchange}</p>
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${resolutionTone(item.resolutionStatus)}`}>
                  {resolutionLabel(item.resolutionStatus)} · {item.identityConfidence ?? 0}%
                </span>
                <p className="mt-1 break-all font-mono text-[10px] leading-4 text-muted">{item.canonicalId ?? "keine Kennung"}</p>
              </div>
              <p className="text-sm text-muted">{item.provider}</p>
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${coverageTone(item.coverage)}`}>
                  {coverageLabel(item.coverage)}
                </span>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${qualityTone(item.quoteQuality)}`}>
                  Kurs: {qualityLabel(item.quoteQuality)} · {item.subscribable ? "streambar" : "nicht streambar"}
                </span>
                {item.resolutionWarnings?.length ? (
                  <p className="mt-1 text-xs leading-5 text-amber">{item.resolutionWarnings.slice(0, 2).join(" ")}</p>
                ) : null}
                <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p>
              </div>
            </article>
          )) : (
            <div className="bg-panel/55 px-4 py-8" role="status" aria-live="polite">
              <p className="font-semibold text-mist">Keine passenden Instrumente gefunden.</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Prüfe Symbol, Name oder Assetklasse. Wenn ein Wert fehlt, ist der Provider noch nicht angebunden,
                die Lizenz fehlt oder das Instrument ist im aktuellen Demo-Universum nicht enthalten.
              </p>
            </div>
          )}
        </div>
      </div>

      {hiddenResultCount > 0 ? (
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3 text-sm leading-6 text-muted" role="status">
          {visibleResults.length} von {filtered.length} Treffern werden angezeigt. Verfeinere die Suche,
          damit große Universen performant bleiben und keine unnötigen Provider-Abfragen entstehen.
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {coverage.map((item) => (
          <article key={item.label} className="rounded-2xl border border-stroke bg-coal/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-mist">{item.label}</h3>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.status === "connected" ? "bg-profit/10 text-profit" : item.status === "prepared" ? "bg-cyan/10 text-cyan" : "bg-amber/10 text-amber"}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{item.note}</p>
            <p className="mt-3 text-xs text-muted">Provider: {item.providerCandidates.join(", ")}</p>
            <p className="mt-1 text-xs text-muted">Börsen: {item.exchanges.join(", ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
