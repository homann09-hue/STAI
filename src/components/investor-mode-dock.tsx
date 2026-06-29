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
    <div className="border-t border-stroke/70 bg-coal/78 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto">
        {(Object.keys(modes) as InvestorMode[]).map((item) => {
          const Icon = modes[item].icon;
          const active = mode === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => selectMode(item)}
              className={`flex min-w-[12rem] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition sm:min-w-0 sm:flex-1 ${
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
      <p className="mx-auto mt-2 max-w-6xl text-[11px] text-muted">
        Aktiver Modus: <span className="font-semibold text-cyan">{modes[mode].label}</span>. Die App priorisiert passende Tiefe, Sprache und Risiko-Hinweise.
      </p>
    </div>
  );
}
