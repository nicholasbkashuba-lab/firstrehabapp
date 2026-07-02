/* First Rehab Team Portal — service worker.
   Keeps the app installable and able to open offline, while ALWAYS preferring
   the network for the page itself so new deploys reach everyone immediately. */
const CACHE = "firstrehab-v1";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept live data / auth traffic.
  if (url.host.endsWith("supabase.co")) return;

  // The page itself: network first (fresh deploys win), cached copy when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); return r; })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets, fonts, and the Supabase JS library: cached copy instantly, refresh in the background.
  if (url.origin === location.origin || /(^|\.)cdn\.jsdelivr\.net$|(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$/.test(url.host)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((r) => {
          if (r && (r.ok || r.type === "opaque")) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
