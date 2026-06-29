"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    const refreshServiceWorker = () => registration?.update().catch(() => undefined);

    navigator.serviceWorker
      .register("/sw.js")
      .then((nextRegistration) => {
        registration = nextRegistration;
        refreshServiceWorker();
      })
      .catch(() => {
        // PWA registration should never block the app shell.
      });

    window.addEventListener("online", refreshServiceWorker);

    return () => {
      window.removeEventListener("online", refreshServiceWorker);
    };
  }, []);

  return null;
}
