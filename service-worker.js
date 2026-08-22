/* ============================================================
   KXS SARI-SARI STORE POS — service-worker.js
   Caches the full app shell so it keeps working with no
   internet connection after the first successful load/install.
   ============================================================ */

const CACHE_NAME = "kxs-sarisari-pos-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/database.js",
  "./js/license.js",
  "./js/settings.js",
  "./js/products.js",
  "./js/inventory.js",
  "./js/pos.js",
  "./js/barcode.js",
  "./js/sales.js",
  "./js/returns.js",
  "./js/customers.js",
  "./js/suppliers.js",
  "./js/expenses.js",
  "./js/cash-drawer.js",
  "./js/reports.js",
  "./js/backup.js",
  "./js/app.js",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell; falls back to network, and
// falls back to the cached index.html for navigation requests
// so deep links still work fully offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
