const STATIC_CACHE = "stockpilot-static-v4";
const DATA_CACHE = "stockpilot-data-v1";
const STATIC_ASSETS = ["/", "/offline", "/manifest.webmanifest", "/icons/icon.svg"];
const PUBLIC_NAVIGATION_PATHS = new Set([
  "/",
  "/markets",
  "/stocks",
  "/etfs",
  "/crypto",
  "/indices",
  "/screener",
  "/news-terminal",
  "/calendar",
  "/analyses",
  "/compare",
  "/risk",
  "/backtesting",
  "/learn",
  "/pricing",
  "/watchlist",
  "/portfolio",
  "/alerts",
  "/settings",
  "/offline"
]);
const CACHEABLE_API_PREFIXES = [
  "/api/assets/",
  "/api/fundamentals/",
  "/api/ai/analysis",
  "/api/news",
  "/api/market/overview",
  "/api/market/quotes",
  "/api/market/universe",
  "/api/professional/overview"
];

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
            .filter((key) => ![STATIC_CACHE, DATA_CACHE].includes(key))
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
    const publicNavigation = sameOrigin && (PUBLIC_NAVIGATION_PATHS.has(url.pathname) || url.pathname.startsWith("/assets/"));

    event.respondWith(
      fetch(request)
        .then((response) => (publicNavigation ? cacheResponse(STATIC_CACHE, request, response) : response))
        .catch(() => (publicNavigation ? caches.match(request).then((cached) => cached || caches.match("/offline")) : caches.match("/offline")))
    );
    return;
  }

  if (sameOrigin && url.pathname.startsWith("/api/")) {
    const cacheableApi = CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) && url.pathname !== "/api/market/stream";

    if (!cacheableApi) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(DATA_CACHE, request, response))
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
