const CACHE_NAME = 'fintrack-shell-v17';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/icons/icon.svg',
  '/vendor/chart.umd.min.js',
  '/vendor/jspdf.umd.min.js',
  '/vendor/xlsx.full.min.js',
  '/js/app.js',
  '/js/db.js',
  '/js/utils.js',
  '/js/charts.js',
  '/js/exportService.js',
  '/js/views/beranda.js',
  '/js/views/transaksi.js',
  '/js/views/kalender.js',
  '/js/views/anggaran.js',
  '/js/views/lainnya.js',
  '/js/views/receiptScanner.js',
  '/js/views/categoryPicker.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bagian 11: Jangan cache payload API keuangan di Service Worker
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((fresh) => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_NAME).then((c) => c.put(request, fresh));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      });
    })
  );
});
