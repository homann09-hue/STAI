const STATIC_CACHE = "stockpilot-static-v5";
const DATA_CACHE = "stockpilot-data-v3";
const STATIC_ASSETS = ["/", "/offline", "/manifest.webmanifest", "/icons/icon.svg"];
const STATIC_ASSET_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_ASSET_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2"
];
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
const CACHEABLE_OFFLINE_API_PREFIXES = [
  "/api/market/universe"
];

async function cacheResponse(cacheName, request, response) {
  if (response.ok) {
    const clone = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, clone);
  }
  return response;
}

function isStaticAssetRequest(url) {
  return (
    STATIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    STATIC_ASSET_EXTENSIONS.some((extension) => url.pathname.endsWith(extension)) ||
    url.pathname === "/manifest.webmanifest"
  );
}

function offlineJson(message, status = 503) {
  return new Response(
    JSON.stringify({
      error: message,
      dataQuality: "offline",
      offline: true,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-StockPilot-Offline": "true"
      }
    }
  );
}

async function cachedOfflineApiResponse(request) {
  const cached = await caches.match(request);
  if (!cached) return offlineJson("Offline und keine gecachte API-Antwort vorhanden.");

  const headers = new Headers(cached.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-StockPilot-Offline-Cache", "hit");
  headers.set("Warning", '110 - "StockPilot offline cache response"');

  return new Response(await cached.blob(), {
    status: cached.status,
    statusText: cached.statusText,
    headers
  });
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
    const cacheableApi = CACHEABLE_OFFLINE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

    if (!cacheableApi) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(DATA_CACHE, request, response))
        .catch(() => cachedOfflineApiResponse(request))
    );
    return;
  }

  if (sameOrigin && isStaticAssetRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(STATIC_CACHE, request, response))
        .catch(() => caches.match(request))
    );
  }
});

// Activate newly installed app shells when the trusted client asks for it.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
