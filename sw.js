/* The Classic — service worker
   - App shell (HTML/CSS/JS/icons) is cached so the site loads in a dead zone.
   - Live data (/api/*, *.json) is always network-first with no offline cache;
     the pages keep their own localStorage copy for offline display and queue
     unsaved score edits until the connection returns.
   Bump CACHE_VERSION to force a fresh precache after a shell change. */
const CACHE_VERSION = "classic-v9";
const SHELL = [
  "/index.html", "/draft.html", "/leaderboard.html", "/history.html", "/admin.html", "/classic-2026.html",
  "/css/styles.css?v=20270912",
  "/leaderboard.js", "/draft.js", "/history.js", "/admin.js", "/matchup-modal.js", "/weather.js",
  "/teams.js", "/classic-2026.js",
  "/manifest.json", "/favicon.ico",
  "/icons/icon-192.png", "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Live score data must never be served stale from the SW.
  if (url.pathname.startsWith("/api/") ||
      url.pathname === "/data.json" || url.pathname === "/history-data.json") return;

  // App shell: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
