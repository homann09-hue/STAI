"use client";

import { useEffect, useRef } from "react";

export function RiskNoticeDialog({ onAccept }: { onAccept: () => void }) {
  const noticeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    noticeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onAccept();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onAccept]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] bg-black/35 px-3 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-notice-title"
        aria-describedby="risk-notice-description"
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            noticeButtonRef.current?.focus();
          }
        }}
        className="pointer-events-auto fixed inset-x-3 bottom-24 mx-auto max-w-xl rounded-md border border-amber/35 bg-coal p-4 shadow-panel sm:bottom-5"
      >
        <p id="risk-notice-title" className="text-sm font-semibold text-amber">Wichtiger Risiko-Hinweis</p>
        <p id="risk-notice-description" className="mt-2 text-xs leading-5 text-muted">
          StockPilot AI liefert keine Finanzberatung, keine Garantie und keine sicheren Signale.
          Scores und KI-Auswertungen sind modellbasierte Entscheidungsunterstuetzung und können falsch sein.
          Prüfe Quellen, Datenqualität und dein Risiko immer selbst.
        </p>
        <button
          ref={noticeButtonRef}
          type="button"
          onClick={onAccept}
          className="relative z-10 mt-4 h-12 w-full rounded-md bg-amber font-semibold text-ink"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
