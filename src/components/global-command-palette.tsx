"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bell, Briefcase, Command, LineChart, Search, Settings2, Star, X } from "lucide-react";

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
  { href: "/compare", label: "Vergleich", group: "Research", hint: "Asset vs Benchmark", keywords: "vergleich compare benchmark asset etf" },
  { href: "/learn", label: "Investieren lernen", group: "Lernen", hint: "Glossar und Beispiel-Portfolios", keywords: "lernen anfänger glossar aktie etf risiko" },
  { href: "/pricing", label: "Pläne", group: "Business", hint: "Free, Starter, Pro, Elite", keywords: "pricing preis pläne pro elite billing" },
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

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commandItems.slice(0, 8);
    return commandItems
      .filter((item) => `${item.label} ${item.group} ${item.hint} ${item.keywords}`.toLowerCase().includes(normalized))
      .slice(0, 10);
  }, [query]);

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
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
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
              )) : (
                <div className="px-4 py-10 text-center" role="status">
                  <p className="font-semibold text-mist">Kein Treffer.</p>
                  <p className="mt-2 text-sm text-muted">Versuche Symbol, Assetklasse, Provider oder Funktionsname.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
