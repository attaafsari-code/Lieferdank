"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker – nur in Produktion. In der Entwicklung
 * würde er veraltete Dateien ausliefern und Änderungen verstecken.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
