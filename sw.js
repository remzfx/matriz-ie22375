/* Service Worker — respaldo estático versionado, siempre network-first. */
const CACHE_PREFIX = 'matriz-ie22375-';
const CACHE = CACHE_PREFIX + 'v2';
const MAX_STATIC_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PRECACHE = [
  './', './index.html', './primaria.html', './secundaria.html',
  './manifest.json', './icon-192.png', './icon-512.png',
  './students.js', './matrix-teachers.js', './student-identity.js',
  './students-migration.js', './aula_innovacion.js'
];
const STATIC_URLS = new Set(PRECACHE.map(path => new URL(path, self.registration.scope).href));
function esJavaScript(req) {
  return req.destination === 'script' || /\.m?js$/i.test(new URL(req.url).pathname);
}
function respuestaEstaticaValida(req, response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  return !esJavaScript(req) || /(?:javascript|ecmascript)/i.test(response.headers.get('Content-Type') || '');
}
async function guardarEstatico(cache, req, response) {
  if (!STATIC_URLS.has(req.url) || !respuestaEstaticaValida(req, response)) return;
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  headers.set('X-IE-Cached-At', String(Date.now()));
  await cache.put(req, new Response(await response.clone().arrayBuffer(), {
    status:response.status, statusText:response.statusText, headers:headers
  }));
}
async function respaldoEstatico(cache, req) {
  const response = await cache.match(req);
  const timestamp = response && Number(response.headers.get('X-IE-Cached-At'));
  if (respuestaEstaticaValida(req, response) && timestamp && Date.now() - timestamp <= MAX_STATIC_AGE_MS) return response;
  if (response) await cache.delete(req);
  return null;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async path => {
      const req = new Request(new URL(path, self.registration.scope).href);
      const response = await fetch(req, {cache:'no-store'});
      if (!respuestaEstaticaValida(req, response)) throw new Error('Recurso estático no disponible');
      await guardarEstatico(cache, req, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  // CDN y APIs externas conservan la respuesta nativa (incluidas las opacas).
  if (req.method !== 'GET' || new URL(req.url).origin !== new URL(self.registration.scope).origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(req, {cache:'no-store'});
      if (esJavaScript(req) && !respuestaEstaticaValida(req, response)) throw new Error('Respuesta JavaScript inválida');
      if (STATIC_URLS.has(req.url)) {
        // Un fallo de almacenamiento no debe convertir una respuesta de red válida en error.
        event.waitUntil(caches.open(CACHE).then(cache => guardarEstatico(cache, req, response)).catch(() => {}));
      }
      return response;
    } catch(e) {
      const cache = await caches.open(CACHE);
      const cached = STATIC_URLS.has(req.url) ? await respaldoEstatico(cache, req) : null;
      if (cached) return cached;
      // Solo una navegación puede recuperar el inicio. JS/API nunca reciben HTML.
      if (!esJavaScript(req) && req.mode === 'navigate') {
        const home = await respaldoEstatico(cache, new Request(new URL('./index.html', self.registration.scope).href));
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
