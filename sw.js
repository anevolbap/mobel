// Service worker: keeps a copy of the app so it opens offline.
// Bump VERSION on every release: the new worker caches the new files and the
// old cache is deleted.
const VERSION = "mobel-1";
const FILES = ["./", "index.html", "core.js", "rearrange.js", "view3d.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the HTTP cache, so the copy is what the server has now
  event.waitUntil(caches.open(VERSION)
    .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first, the cached copy when offline. Serving the scripts cache first
// would pair a new index.html with the old scripts on the first visit after a release.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })
    .then((hit) => hit || (event.request.mode === "navigate" ? caches.match("./") : Response.error()))));
});
