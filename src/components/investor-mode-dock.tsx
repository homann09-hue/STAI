"use client";

import { GraduationCap, LineChart, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type InvestorMode = "beginner" | "advanced" | "pro";

const modes: Record<InvestorMode, { label: string; hint: string; icon: typeof GraduationCap }> = {
  beginner: {
    label: "Anfänger",
    hint: "Einfache Sprache, Ampel, Risiko zuerst.",
    icon: GraduationCap
  },
  advanced: {
    label: "Fortgeschritten",
    hint: "Kennzahlen, News, Vergleiche.",
    icon: LineChart
  },
  pro: {
    label: "Profi",
    hint: "Szenarien, Drawdown, Governance.",
    icon: ShieldCheck
  }
};

export function InvestorModeDock() {
  const [mode, setMode] = useState<InvestorMode>("beginner");

  useEffect(() => {
    const stored = window.localStorage.getItem("stockpilot:investor-mode") as InvestorMode | null;
    if (stored && stored in modes) setMode(stored);
  }, []);

  function selectMode(nextMode: InvestorMode) {
    setMode(nextMode);
    window.localStorage.setItem("stockpilot:investor-mode", nextMode);
    window.dispatchEvent(new CustomEvent("stockpilot:investor-mode", { detail: nextMode }));
  }

  return (
    <section
      aria-labelledby="investor-mode-heading"
      className="rounded-[2rem] border border-cyan/20 bg-panel/82 p-4 shadow-panel sm:p-5"
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan">
          Personalisierung
        </p>
        <h2 id="investor-mode-heading" className="mt-2 text-2xl font-semibold text-mist">
          Zielgruppen-Modus
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Wähle hier, wie tief StockPilot AI Inhalte erklärt. Das Dashboard bleibt dadurch ruhig,
          während Sprache, Hinweise und Analyse-Tiefe zu deinem Erfahrungslevel passen.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3" role="group" aria-label="Zielgruppen-Modus wählen">
        {(Object.keys(modes) as InvestorMode[]).map((item) => {
          const Icon = modes[item].icon;
          const active = mode === item;

          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => selectMode(item)}
              className={`flex min-h-24 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? "border-cyan/35 bg-cyan/10 text-cyan"
                  : "border-stroke bg-panel/60 text-muted hover:border-cyan/30 hover:text-mist"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>
                <span className="block text-xs font-semibold">{modes[item].label}</span>
                <span className="block text-[11px] leading-4">{modes[item].hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 rounded-2xl border border-stroke bg-coal/55 px-3 py-2 text-xs leading-5 text-muted">
        Aktiver Modus: <span className="font-semibold text-cyan">{modes[mode].label}</span>. Die App priorisiert passende Tiefe, Sprache und Risiko-Hinweise.
      </p>
    </section>
  );
}
