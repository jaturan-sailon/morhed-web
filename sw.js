// Cache version. BUMP THIS on any change to the cached shell, or clients keep the old build.
// v1 was cache-first with a fixed name and no activate handler, so index.html was pinned
// forever on every device that had ever opened the app.
const C = "morhed-v2";
const SHELL = ["./index.html", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Drop every cache that isn't the current one, then take over open tabs immediately.
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== C) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.url.includes("/api/")) return;
  const isDoc = req.mode === "navigate" || /\.(html|js|json)$/.test(new URL(req.url).pathname);
  if (isDoc) {
    // network-first: always try for a fresh build; fall back to cache only when offline
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(C); c.put(req, res.clone());
        return res;
      } catch { return (await caches.match(req)) || Response.error(); }
    })());
  } else {
    // images, fonts: cache-first is fine, they are content-addressed or rarely change
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
