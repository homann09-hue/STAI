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
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/35 px-3 pb-24 backdrop-blur-[2px] sm:pb-5">
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
        className="relative z-[10000] w-full max-w-xl rounded-md border border-amber/35 bg-coal p-4 pb-20 shadow-panel sm:pb-4"
      >
        <p id="risk-notice-title" className="text-sm font-semibold text-amber">Wichtiger Risiko-Hinweis</p>
        <p id="risk-notice-description" className="mt-2 text-xs leading-5 text-muted">
          StockPilot AI liefert keine Finanzberatung, keine Garantie und keine sicheren Signale.
          Scores und KI-Auswertungen sind modellbasierte Entscheidungsunterstützung und können falsch sein.
          Prüfe Quellen, Datenqualität und dein Risiko immer selbst.
        </p>
        <button
          ref={noticeButtonRef}
          type="button"
          onClick={onAccept}
          className="fixed inset-x-6 bottom-28 z-[10001] mx-auto h-12 max-w-xl rounded-md bg-amber font-semibold text-ink sm:static sm:mt-4 sm:w-full sm:max-w-none"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
