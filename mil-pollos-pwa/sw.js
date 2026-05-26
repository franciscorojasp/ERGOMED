// Service Worker – Mil Pollos Salud Ocupacional
const CACHE_NAME = 'milpollos-v1.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './css/print.css',
  './js/app.js',
  './js/db.js',
  './js/workers.js',
  './js/evaluaciones.js',
  './js/aptitud.js',
  './js/presion.js',
  './js/reposos.js',
  './js/referencias.js',
  './js/goniometria.js',
  './js/inpsasel.js',
  './js/consultas.js',
  './js/morbilidad.js',
  './js/formatos.js',
  './js/charts.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
