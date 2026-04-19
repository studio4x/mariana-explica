const CACHE_VERSION = "mariana-explica-pwa-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

function isSafeRuntimeAsset(requestUrl, request) {
  if (requestUrl.origin !== self.location.origin) {
    return false;
  }

  if (request.headers.has("authorization")) {
    return false;
  }

  if (requestUrl.search) {
    return false;
  }

  if (
    requestUrl.pathname.startsWith("/auth/") ||
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/functions/") ||
    requestUrl.pathname.startsWith("/storage/")
  ) {
    return false;
  }

  return ["script", "style", "image", "font", "manifest"].includes(request.destination);
}

function shouldCacheNavigation(requestUrl) {
  if (requestUrl.origin !== self.location.origin) {
    return false;
  }

  if (
    requestUrl.pathname.startsWith("/auth/") ||
    requestUrl.pathname.startsWith("/redefinir-senha")
  ) {
    return false;
  }

  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .finally(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .finally(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    if (!shouldCacheNavigation(requestUrl)) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        }),
    );
    return;
  }

  if (!isSafeRuntimeAsset(requestUrl, request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    }),
  );
});
