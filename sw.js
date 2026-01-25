const CACHE = 'labejar-v8';
const ASSETS = [
  '/Labejar/',
  '/Labejar/index.html',
  '/Labejar/Fil.cleaned.html',
  '/Labejar/manifest.webmanifest',
  '/Labejar/abeja.png',
  '/Labejar/docu.png',
  '/Labejar/parser.js',
  '/Labejar/crypto_json.js',
  '/Labejar/comparecencia.js',
  '/Labejar/servicios.js',
  '/Labejar/municipios.js',
  '/Labejar/provincias_es.js',
  '/Labejar/paises.js',
  '/Labejar/calles.js',
  '/Labejar/icons/icon-192.png',
  '/Labejar/icons/icon-512.png',
  '/Labejar/icons/icon-192-maskable.png',
  '/Labejar/icons/icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
