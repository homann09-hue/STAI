"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  INVESTOR_MODE_EVENT,
  INVESTOR_MODE_STORAGE_KEY,
  normalizeInvestorMode,
  type InvestorMode
} from "@/lib/investor-mode";

let sessionMode: InvestorMode = "beginner";

function readSnapshot(): InvestorMode {
  if (typeof window === "undefined") return "beginner";

  try {
    sessionMode = normalizeInvestorMode(window.localStorage.getItem(INVESTOR_MODE_STORAGE_KEY));
  } catch {
    // Der letzte Modus dieser Sitzung bleibt aktiv, wenn Browser-Speicher blockiert ist.
  }

  return sessionMode;
}

function subscribe(callback: () => void) {
  const onModeChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === INVESTOR_MODE_STORAGE_KEY) callback();
  };

  window.addEventListener(INVESTOR_MODE_EVENT, onModeChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(INVESTOR_MODE_EVENT, onModeChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setInvestorMode(mode: InvestorMode) {
  sessionMode = normalizeInvestorMode(mode);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(INVESTOR_MODE_STORAGE_KEY, sessionMode);
  } catch {
    // Die laufende Sitzung funktioniert auch ohne persistenten Browser-Speicher.
  }

  document.documentElement.dataset.investorMode = sessionMode;
  window.dispatchEvent(new CustomEvent(INVESTOR_MODE_EVENT, { detail: sessionMode }));
}

export function useInvestorMode(): readonly [InvestorMode, (mode: InvestorMode) => void] {
  const mode = useSyncExternalStore(subscribe, readSnapshot, (): InvestorMode => "beginner");

  useEffect(() => {
    document.documentElement.dataset.investorMode = mode;
  }, [mode]);

  return [mode, setInvestorMode] as const;
}
