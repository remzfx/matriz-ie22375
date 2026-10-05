/* Service Worker — Matriz IE 22375 · local-first básico */
const CACHE = 'matriz-ie22375-v2';
const PRECACHE = [
  './',
  './index.html',
  './registro.html',
  './students.js',
  './student-identity.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCore = sameOrigin && PRECACHE.some((p) => url.pathname.endsWith(p.replace('./','')));

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  if (isCore || req.destination === 'script' || req.destination === 'style' || req.destination === 'image') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        }).catch(() => null);
        return cached || fresh.then((res) => res || Response.error());
      })
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
