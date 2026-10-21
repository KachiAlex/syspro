/* Pisairtel ERP service worker.
   Strategy: network-first for pages/API (freshness + auth correctness),
   cache-first for hashed static assets. Offline falls back to the cached
   shell so an installed app still opens. */
const STATIC_CACHE = "pisairtel-static-v1";
const SHELL_CACHE = "pisairtel-shell-v1";
const SHELL_URL = "/tenant-admin";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC_CACHE, SHELL_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build assets — cache-first, safe to serve stale.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // API + data — network only (auth + tenant data must never go stale).
  if (url.pathname.startsWith("/api/")) return;

  // Documents — network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname.startsWith("/tenant-admin")) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, clone));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(SHELL_URL)) || Response.error();
        })
    );
  }
});
