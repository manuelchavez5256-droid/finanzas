// Service worker: guarda una copia de la app para que abra sin internet.
// Estrategia "red primero": si hay internet usa la versión más nueva y actualiza la copia;
// si no hay, usa la copia guardada.

const CACHE = 'finanzas-v1';
const ARCHIVOS = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/sync.js',
  'js/utils.js',
  'js/config.js',
  'vendor/chart.umd.js',
  'vendor/supabase.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  // Las llamadas a Supabase (otro dominio) y los datos importados no se guardan
  if (evento.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/data/')) return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request, { ignoreSearch: true })),
  );
});
