const STATIC_CACHE = "stockpilot-static-v2";
const API_CACHE = "stockpilot-api-v2";
const STATIC_ASSETS = ["/", "/offline", "/icons/icon.svg"];

async function cacheResponse(cacheName, request, response) {
  if (response.ok) {
    const clone = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, clone);
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, API_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(STATIC_CACHE, request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline")))
    );
    return;
  }

  if (sameOrigin && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(API_CACHE, request, response))
        .catch(() => caches.match(request))
    );
    return;
  }

  if (sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(STATIC_CACHE, request, response))
        .catch(() => caches.match(request))
    );
  }
});
