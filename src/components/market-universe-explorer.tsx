"use client";

import { useMemo, useState } from "react";
import { Database, LockKeyhole, Radio, Search } from "lucide-react";
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

export function MarketUniverseExplorer({
  instruments,
  coverage
}: {
  instruments: MarketUniverseInstrument[];
  coverage: MarketUniverseCoverage[];
}) {
  const [query, setQuery] = useState("");
  const [assetClass, setAssetClass] = useState<MarketUniverseAssetClass | "all">("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return instruments.filter((item) => {
      if (assetClass !== "all" && item.assetClass !== assetClass) return false;
      if (!normalizedQuery) return true;
      return `${item.symbol} ${item.name} ${item.exchange} ${item.country} ${item.assetClass}`.toLowerCase().includes(normalizedQuery);
    });
  }, [assetClass, instruments, query]);

  const stats = {
    available: instruments.filter((item) => item.coverage === "available").length,
    prepared: instruments.filter((item) => item.coverage === "prepared").length,
    license: instruments.filter((item) => item.coverage === "license_required").length,
    subscribable: instruments.filter((item) => item.subscribable).length
  };

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
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[28rem]">
          <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
            <Radio className="h-4 w-4 text-profit" />
            <p className="mt-2 font-mono text-xl font-semibold text-profit">{stats.available}</p>
            <p className="text-xs text-muted">{stats.subscribable} streambar</p>
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

      <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Globales Marktuniversum durchsuchen</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full rounded-2xl border border-stroke bg-coal pl-11 pr-4 text-sm text-mist outline-none transition placeholder:text-muted focus:border-cyan/60"
            placeholder="Suche Symbol, Name, Börse, Land, Assetklasse..."
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

      <div className="overflow-hidden rounded-2xl border border-stroke">
        <div className="hidden grid-cols-[0.8fr_1.5fr_0.8fr_0.8fr_0.9fr_1fr] gap-3 border-b border-stroke bg-coal px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted xl:grid">
          <span>Symbol</span>
          <span>Name</span>
          <span>Klasse</span>
          <span>Börse</span>
          <span>Provider</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-stroke">
          {filtered.map((item) => (
            <article key={`${item.symbol}-${item.exchange}`} className="grid gap-2 bg-panel/55 px-4 py-4 xl:grid-cols-[0.8fr_1.5fr_0.8fr_0.8fr_0.9fr_1fr] xl:items-center">
              <p className="font-mono text-lg font-semibold text-mist">{item.symbol}</p>
              <div>
                <p className="font-semibold text-mist">{item.name}</p>
                <p className="text-xs text-muted">{item.country} · {item.currency}</p>
              </div>
              <p className="text-sm uppercase tracking-[0.14em] text-muted">{item.assetClass}</p>
              <p className="text-sm text-muted">{item.exchange}</p>
              <p className="text-sm text-muted">{item.provider}</p>
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${coverageTone(item.coverage)}`}>
                  {coverageLabel(item.coverage)}
                </span>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${qualityTone(item.quoteQuality)}`}>
                  Kurs: {qualityLabel(item.quoteQuality)} · {item.subscribable ? "streambar" : "nicht streambar"}
                </span>
                <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

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
