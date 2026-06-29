"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpen,
  Briefcase,
  Gem,
  Home,
  Search,
  ShieldAlert,
  WifiOff
} from "lucide-react";
import { useEffect, useState } from "react";
import { legalDisclaimer } from "@/lib/scoring";
import { InvestorModeDock } from "@/components/investor-mode-dock";
import { PwaRegister } from "@/components/PwaRegister";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/assets/NVDA", label: "Analyse", icon: Activity },
  { href: "/learn", label: "Lernen", icon: BookOpen },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/pricing", label: "Pläne", icon: Gem }
];

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
    <div className="min-h-screen bg-ink text-mist">
      <PwaRegister />
      <header className="sticky top-0 z-40 border-b border-stroke/80 bg-coal/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-profit/30 bg-profit/12 shadow-glow">
              <Activity className="h-5 w-5 text-profit" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">StockPilot AI</p>
              <p className="truncate text-xs text-muted">Von 1 € bis Profi-Portfolio</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 rounded-2xl border border-stroke bg-panel/70 p-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
            <button
              type="button"
              aria-label="Suche offnen"
              title="Suche"
              className="grid h-10 w-10 place-items-center rounded-md border border-stroke bg-panel text-muted transition hover:border-cyan/40 hover:text-cyan"
            >
              <Search className="h-4 w-4" />
            </button>
            <div
              className={`hidden items-center gap-2 rounded-md border px-3 py-2 text-xs sm:flex ${
                online
                  ? "border-profit/20 bg-profit/10 text-profit"
                  : "border-loss/30 bg-loss/10 text-loss"
              }`}
            >
              {online ? <ShieldAlert className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </div>
        <div className="border-t border-stroke/70 bg-amber/10 px-4 py-2 text-center text-[11px] leading-snug text-amber">
          {legalDisclaimer}
        </div>
        <InvestorModeDock />
      </header>

      <main className="mx-auto min-h-[calc(100vh-140px)] max-w-6xl px-4 pb-28 pt-5 sm:pb-10">
        {children}
      </main>

      {!noticeAccepted ? (
        <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-xl rounded-md border border-amber/35 bg-coal p-4 shadow-panel sm:bottom-5">
          <p className="text-sm font-semibold text-amber">Wichtiger Risiko-Hinweis</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            StockPilot AI liefert keine Finanzberatung, keine Garantie und keine sicheren Signale.
            Scores und KI-Auswertungen sind modellbasierte Entscheidungsunterstuetzung und können falsch sein.
            Prüfe Quellen, Datenqualität und dein Risiko immer selbst.
          </p>
          <button
            type="button"
            onClick={acceptNotice}
            className="mt-4 h-10 w-full rounded-md bg-amber font-semibold text-ink"
          >
            Verstanden
          </button>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stroke bg-coal/94 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-xl sm:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
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
