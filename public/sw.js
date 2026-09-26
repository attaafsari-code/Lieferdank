/*
 * Lieferdank Service Worker
 *
 * Bewusst zurückhaltend:
 *  - Seiten immer zuerst aus dem Netz (Zahlungen und Guthaben müssen aktuell sein)
 *  - ohne Netz: Offline-Seite statt Browserfehler
 *  - statische Dateien (Build, Schrift, Icons) aus dem Cache
 *  - API, Zahlungen und POST-Anfragen werden nie gecacht
 */
const VERSION = "lieferdank-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/fonts/plus-jakarta-sans-latin.woff2", "/pwa/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname === "/icon.svg"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/zahlung/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
