/* Офлайн-кэш приложения. Сами файлы с выгрузками сюда не попадают — только код приложения. */
const VERSION = "kpi-v5";
const FILES = ["./", "index.html", "manifest.webmanifest", "js/xlsx.js", "js/loader.js", "js/analysis.js", "js/report.js", "js/share.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // сначала сеть в обход кэша браузера (чтобы обновления приходили сразу), без сети — из кэша приложения
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
