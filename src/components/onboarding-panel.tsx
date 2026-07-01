"use client";

import { useEffect, useState } from "react";
import { Rocket, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";

type OnboardingProfile = {
  level: "anfänger" | "fortgeschritten" | "profi";
  goal: "lernen" | "watchlist" | "portfolio" | "trading";
  capital: "1-100" | "100-1000" | "1000-10000" | "10000+";
  risk: "niedrig" | "mittel" | "hoch";
};

const defaultProfile: OnboardingProfile = {
  level: "fortgeschritten",
  goal: "portfolio",
  capital: "1000-10000",
  risk: "mittel"
};

export function OnboardingPanel() {
  const [profile, setProfile] = useState<OnboardingProfile>(defaultProfile);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = readOfflineValue<OnboardingProfile>(OFFLINE_KEYS.onboardingProfile);
    if (stored) setProfile(stored);
  }, []);

  function update<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function save() {
    saveOfflineValue(OFFLINE_KEYS.onboardingProfile, profile);
    setSavedAt(new Date().toISOString());
  }

  return (
    <section className="rounded-[1.7rem] border border-stroke bg-[radial-gradient(circle_at_top_left,rgba(120,231,255,0.12),transparent_30%),linear-gradient(145deg,rgba(9,14,24,0.96),rgba(3,6,11,0.98))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">Onboarding & Personalisierung</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">Dashboard auf Ziel, Kapital und Risiko abstimmen</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Dieses Profil steuert lokal, welche Sprache, Hinweise und Workflows STAI priorisieren soll.
            Cloud-Sync kann später an Supabase User-Settings gekoppelt werden.
          </p>
        </div>
        <button type="button" onClick={save} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-profit px-4 font-semibold text-ink">
          <Rocket className="h-4 w-4" />
          Profil speichern
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <label className="text-sm text-muted">
          Level
          <select value={profile.level} onChange={(event) => update("level", event.target.value as OnboardingProfile["level"])} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan">
            <option value="anfänger">Anfänger</option>
            <option value="fortgeschritten">Fortgeschritten</option>
            <option value="profi">Profi</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Ziel
          <select value={profile.goal} onChange={(event) => update("goal", event.target.value as OnboardingProfile["goal"])} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan">
            <option value="lernen">Lernen</option>
            <option value="watchlist">Watchlist</option>
            <option value="portfolio">Portfolio</option>
            <option value="trading">Trading</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Kapital
          <select value={profile.capital} onChange={(event) => update("capital", event.target.value as OnboardingProfile["capital"])} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan">
            <option value="1-100">1-100 €</option>
            <option value="100-1000">100-1.000 €</option>
            <option value="1000-10000">1.000-10.000 €</option>
            <option value="10000+">10.000 €+</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Risiko
          <select value={profile.risk} onChange={(event) => update("risk", event.target.value as OnboardingProfile["risk"])} className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan">
            <option value="niedrig">niedrig</option>
            <option value="mittel">mittel</option>
            <option value="hoch">hoch</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-profit/25 bg-profit/10 p-3">
          <ShieldCheck className="h-4 w-4 text-profit" />
          <p className="mt-2 text-sm font-semibold text-mist">Risikoprofil</p>
          <p className="mt-1 text-xs leading-5 text-muted">STAI priorisiert Warnungen passend zu {profile.risk}em Risiko.</p>
        </div>
        <div className="rounded-2xl border border-cyan/25 bg-cyan/10 p-3">
          <SlidersHorizontal className="h-4 w-4 text-cyan" />
          <p className="mt-2 text-sm font-semibold text-mist">Nutzungsziel</p>
          <p className="mt-1 text-xs leading-5 text-muted">Fokus: {profile.goal}. Das reduziert unnötige Oberfläche.</p>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3">
          <Rocket className="h-4 w-4 text-amber" />
          <p className="mt-2 text-sm font-semibold text-mist">Status</p>
          <p className="mt-1 text-xs leading-5 text-muted">{savedAt ? `Gespeichert ${new Date(savedAt).toLocaleString("de-DE")}` : "Lokal bereit, noch nicht gespeichert."}</p>
        </div>
      </div>
    </section>
  );
}
