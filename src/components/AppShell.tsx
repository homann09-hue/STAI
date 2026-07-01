"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Gem,
  Globe2,
  Home,
  LineChart,
  ListFilter,
  Newspaper,
  Search,
  Settings2,
  ShieldAlert,
  Star,
  WifiOff
} from "lucide-react";
import { useEffect, useState } from "react";
import { legalDisclaimer } from "@/lib/scoring";
import { PwaRegister } from "@/components/PwaRegister";
import { RiskNoticeDialog } from "@/components/risk-notice-dialog";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/markets", label: "Märkte", icon: Globe2 },
  { href: "/stocks", label: "Aktien", icon: BarChart3 },
  { href: "/etfs", label: "ETFs", icon: LineChart },
  { href: "/crypto", label: "Krypto", icon: Activity },
  { href: "/indices", label: "Indizes", icon: Globe2 },
  { href: "/screener", label: "Screener", icon: ListFilter },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/news-terminal", label: "News", icon: Newspaper },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/analyses", label: "Analysen", icon: ShieldAlert },
  { href: "/backtesting", label: "Backtesting", icon: Activity },
  { href: "/learn", label: "Lernen", icon: BookOpen },
  { href: "/pricing", label: "Pläne", icon: Gem },
  { href: "/settings", label: "Einstellungen", icon: Settings2 }
];

const mobileNavItems = navItems.filter((item) =>
  ["/", "/markets", "/watchlist", "/portfolio", "/settings"].includes(item.href)
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [noticeAccepted, setNoticeAccepted] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    setNoticeAccepted(window.localStorage.getItem("stockpilot:risk-notice") === "accepted");
    const setOnlineState = () => setOnline(true);
    const setOfflineState = () => setOnline(false);

    window.addEventListener("online", setOnlineState);
    window.addEventListener("offline", setOfflineState);

    return () => {
      window.removeEventListener("online", setOnlineState);
      window.removeEventListener("offline", setOfflineState);
    };
  }, []);

  function acceptNotice() {
    window.localStorage.setItem("stockpilot:risk-notice", "accepted");
    setNoticeAccepted(true);
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-mist">
      <PwaRegister />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-[#1b2a3f] bg-[#07111f]/96 p-4 shadow-[22px_0_60px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-1">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan shadow-glow">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="bg-gradient-to-r from-[#f3d7ff] via-[#b99cff] to-[#58a6ff] bg-clip-text text-3xl font-black tracking-tight text-transparent">
              STAI
            </p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">StockPilot AI</p>
          </div>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const separated = item.href === "/watchlist" || item.href === "/learn" || item.href === "/settings";

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  separated ? "mt-3 border-t border-stroke/70 pt-5" : ""
                } ${
                  active
                    ? "bg-gradient-to-r from-[#6d3df5] to-[#1677ff] text-white shadow-[0_12px_30px_rgba(63,92,255,0.28)]"
                    : "text-muted hover:bg-[#101c2e] hover:text-mist"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.href === "/learn" ? (
                  <span className="ml-auto rounded-md bg-[#6d3df5] px-2 py-0.5 text-[10px] text-white">NEU</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-[#22324a] bg-[#0c1829] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#7758ff] to-[#39a4ff] text-sm font-bold text-white">
              MP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist">Mein Profil</p>
              <p className="text-xs text-muted">Demo / kein Billingstatus</p>
            </div>
            <button className="ml-auto rounded-xl border border-stroke bg-panel px-2 py-1 text-xs text-muted" type="button" aria-label="Profil Optionen">
              ⋯
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#1b2a3f] bg-[#07111f]/92 backdrop-blur-xl lg:ml-64">
        <div className="mx-auto flex max-w-none items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-profit/30 bg-profit/12 shadow-glow">
              <Activity className="h-5 w-5 text-profit" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">StockPilot AI</p>
              <p className="truncate text-xs text-muted">Von 1 € bis Profi-Portfolio</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <form action="/screener" className="relative hidden min-w-[28rem] max-w-3xl flex-1 lg:block" role="search" aria-label="Globale Suche">
              <span className="sr-only">Suche</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                enterKeyHint="search"
                className="h-11 w-full rounded-xl border border-[#22324a] bg-[#0b1525] pl-11 pr-12 text-sm text-mist outline-none transition placeholder:text-muted focus:border-[#4f7cff]"
                placeholder="Suche nach Aktien, ETFs, Krypto, Indizes... (z.B. AAPL, TSLA, BTC, MSCI)"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">⌘K</span>
            </form>
            <nav className="hidden max-w-[62vw] items-center gap-1 overflow-x-auto rounded-2xl border border-stroke bg-panel/70 p-1 md:flex lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-profit/12 text-profit"
                        : "text-muted hover:bg-panel2 hover:text-mist"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/screener"
              aria-label="Suche öffnen"
              title="Suche"
              className="grid h-11 w-11 place-items-center rounded-md border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan lg:hidden"
            >
              <Search className="h-4 w-4" />
            </Link>
            <div
              aria-live="polite"
              className={`hidden items-center gap-2 rounded-md border px-3 py-2 text-xs sm:flex ${
                online
                  ? "border-profit/20 bg-profit/10 text-profit"
                  : "border-loss/30 bg-loss/10 text-loss"
              }`}
            >
              {online ? <ShieldAlert className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {online ? "Verbindung online" : "Offline"}
            </div>
            <Link href="/alerts" className="hidden h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan lg:grid" aria-label="Alarme">
              <Bell className="h-4 w-4" />
            </Link>
            <Link href="/watchlist" className="hidden h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan lg:grid" aria-label="Watchlist">
              <Star className="h-4 w-4" />
            </Link>
            <Link href="/settings" className="hidden h-10 w-10 place-items-center rounded-xl border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan lg:grid" aria-label="Einstellungen">
              <Settings2 className="h-4 w-4" />
            </Link>
            <Link href="/watchlist" className="hidden rounded-xl bg-gradient-to-r from-[#6d3df5] to-[#1677ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(63,92,255,0.25)] lg:block">
              Watchlist
            </Link>
          </div>
        </div>
        <div className="border-t border-stroke/70 bg-amber/10 px-4 py-2 text-center text-[11px] leading-snug text-amber lg:fixed lg:bottom-0 lg:left-64 lg:right-0 lg:z-40 lg:flex lg:h-8 lg:items-center lg:justify-center lg:gap-5 lg:border-[#1b2a3f] lg:bg-[#07111f]/96 lg:px-4 lg:py-0 lg:text-muted lg:backdrop-blur-xl">
          {legalDisclaimer}
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-140px)] max-w-6xl px-4 pb-28 pt-5 sm:pb-10 lg:ml-64 lg:max-w-none lg:px-3 lg:pb-12 lg:pt-3">
        {children}
      </main>

      {!noticeAccepted ? <RiskNoticeDialog onAccept={acceptNotice} /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stroke bg-coal/94 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-xl sm:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-md text-[11px] transition ${
                  active
                    ? "bg-profit/12 text-profit"
                    : "text-muted hover:bg-panel2 hover:text-mist"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
