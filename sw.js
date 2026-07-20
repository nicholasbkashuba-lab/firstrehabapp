/* First Rehab Team Portal — service worker.
   Keeps the app installable and able to open offline, while ALWAYS preferring
   the network for the page itself so new deploys reach everyone immediately. */
const CACHE = "firstrehab-v4";
const PRECACHE = [
  "/",
  "/supabase.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
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

/* ---- Push notifications (announcements, messages, time-off updates) ---- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch (_err) { d = { title: "First Rehab", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "First Rehab", {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept live data / auth traffic.
  if (url.host.endsWith("supabase.co")) return;

  // The page itself: network first (fresh deploys win), cached copy when offline.
  // Only a REAL page (2xx, same-origin, non-redirected) may replace the offline copy —
  // a captive-portal page or a host error page must never poison the fallback.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r && r.ok && r.type === "basic" && !r.redirected) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); }
          return r;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets, fonts, and the Supabase JS library: cached copy instantly, refresh in the background.
  // Only verifiably-good (2xx) responses may overwrite a cached copy — opaque responses hide
  // their status, so a CDN error body could otherwise silently replace the working library.
  if (url.origin === location.origin || /(^|\.)cdn\.jsdelivr\.net$|(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$/.test(url.host)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((r) => {
          if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
