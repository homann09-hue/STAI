"use client";

import { useEffect, useState } from "react";

type PwaNotice = {
  kind: "offline" | "online" | "update";
  title: string;
  message: string;
} | null;

const noticeTone = {
  offline: "border-amber/35 bg-amber/12 text-amber",
  online: "border-profit/35 bg-profit/12 text-profit",
  update: "border-cyan/35 bg-cyan/12 text-cyan"
};

export function PwaRegister() {
  const [notice, setNotice] = useState<PwaNotice>(null);
  const [waitingRegistration, setWaitingRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let noticeTimer: number | undefined;
    let disposed = false;
    let controllerReloaded = false;

    const clearNoticeTimer = () => {
      if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
      noticeTimer = undefined;
    };

    const showNotice = (nextNotice: NonNullable<PwaNotice>, autoHide = true) => {
      if (disposed) return;
      clearNoticeTimer();
      setNotice(nextNotice);
      if (autoHide) {
        noticeTimer = window.setTimeout(() => setNotice(null), 6500);
      }
    };

    const refreshServiceWorker = () => registration?.update().catch(() => undefined);
    const watchRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      if (nextRegistration.waiting && navigator.serviceWorker.controller) {
        setWaitingRegistration(nextRegistration);
        showNotice(
          {
            kind: "update",
            title: "Neue Version bereit",
            message: "Aktualisiere die App, wenn du die neueste STAI-Version laden willst."
          },
          false
        );
      }

      nextRegistration.addEventListener("updatefound", () => {
        const worker = nextRegistration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingRegistration(nextRegistration);
            showNotice(
              {
                kind: "update",
                title: "Neue Version bereit",
                message: "Eine aktualisierte App-Shell wurde geladen und kann aktiviert werden."
              },
              false
            );
          }
        });
      });
    };

    const handleControllerChange = () => {
      if (disposed || controllerReloaded) return;
      controllerReloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((nextRegistration) => {
        if (disposed) return;
        registration = nextRegistration;
        watchRegistration(nextRegistration);
        refreshServiceWorker();
      })
      .catch(() => {
        // PWA registration should never block the app shell.
      });

    const handleOnline = () => {
      showNotice({
        kind: "online",
        title: "Wieder online",
        message: "STAI aktualisiert Daten, sobald Provider und Rate-Limits es erlauben."
      });
      refreshServiceWorker();
    };
    const handleOffline = () => {
      showNotice(
        {
          kind: "offline",
          title: "Offline-Modus",
          message: "Du siehst lokale Watchlists und letzte Analysen. Neue Marktdaten brauchen Verbindung."
        },
        false
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      disposed = true;
      clearNoticeTimer();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const activateUpdate = () => {
    const waitingWorker = waitingRegistration?.waiting;
    if (!waitingWorker) {
      window.location.reload();
      return;
    }

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => window.location.reload(), 1800);
  };

  if (!notice) return null;

  return (
    <div
      role={notice.kind === "offline" ? "alert" : "status"}
      aria-live={notice.kind === "offline" ? "assertive" : "polite"}
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-xl rounded-2xl border p-3 shadow-panel backdrop-blur ${noticeTone[notice.kind]}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{notice.message}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {notice.kind === "update" ? (
            <button
              type="button"
              onClick={activateUpdate}
              className="min-h-10 rounded-xl border border-cyan/35 bg-cyan/10 px-3 text-xs font-semibold text-cyan"
            >
              Aktualisieren
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="min-h-10 rounded-xl border border-stroke bg-coal px-3 text-xs font-semibold text-mist"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
