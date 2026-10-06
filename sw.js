/* Service Worker — respaldo estático versionado, siempre network-first. */
const CACHE_PREFIX = 'matriz-ie22375-';
const CACHE = CACHE_PREFIX + 'v11';
const MAX_STATIC_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PRECACHE = [
  './', './index.html', './primaria.html', './secundaria.html', './auxiliar.html',
  './manifest.json', './icon-192.png', './icon-512.png',
  './students.js', './matrix-teachers.js', './student-identity.js', './auxiliar-permissions.js', './login-bridge.js',
  './transversales.html', './transversales-client.js', './registro-evaluation.js', './registro-transversales.js', './students-migration.js', './aula_innovacion.js'
];
const STATIC_URLS = new Set(PRECACHE.map(path => new URL(path, self.registration.scope).href));
// Puente de lectura: comparte una petición en curso entre Hub y Auxiliar al navegar.
// Nunca se escribe información privada en CacheStorage; la petición en curso vive solo en memoria.
const STUDENTS_API = 'https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
const studentReads = new Map();
self.addEventListener('message', event => {
  const data=event.data||{},port=event.ports&&event.ports[0];
  if (!port || !event.source || !event.source.url.startsWith(self.registration.scope)) return;
  if (data.type==='IE_STUDENTS_PROBE_V1') {port.postMessage({supported:true});return;}
  if (data.type!=='IE_STUDENTS_READ_V1') return;
  let claims;
  try {claims=JSON.parse(atob(String(data.token).split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));}catch(e){}
  if (!claims || claims.role!=='auxiliar' || !(Number(claims.exp)>Date.now()) ||
      (data.bimestre && !['I','II','III','IV'].includes(data.bimestre))) {
    port.postMessage({error:{code:'SESSION',message:'Sesión ausente o vencida.',retryable:false}});return;
  }
  const key=data.token+'|'+(data.bimestre||'');
  studentReads.forEach((entry,k)=>{if(entry.until<=Date.now())studentReads.delete(k);});
  let entry=studentReads.get(key);
  if (!entry) {
    entry={until:Math.min(Number(claims.exp),Date.now()+30000)};
    entry.task=(async()=>{
      const ctrl=new AbortController();let timer;
      try {
        const result=await Promise.race([
          (async()=>{
            const r=await fetch(STUDENTS_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:ctrl.signal,
              body:JSON.stringify({action:'loadstudents',token:data.token,...(data.bimestre?{bimestre:data.bimestre}:{})})});
            if (!r.ok) throw {code:'HTTP',message:'No se pudo conectar con el servidor.',retryable:r.status!==401&&r.status!==403};
            return await r.json();
          })(),
          new Promise((_,reject)=>{timer=setTimeout(()=>{ctrl.abort();reject({code:'TIMEOUT',message:'El servidor tardó demasiado.',retryable:true});},12000);})
        ]);
        if (!result || !result.ok) studentReads.delete(key);
        return {response:result};
      } catch(e) {studentReads.delete(key);return {error:{code:e.code||'NETWORK',message:e.message||'No se pudo conectar con el servidor.',retryable:e.code?!!e.retryable:true}};}
      finally {clearTimeout(timer);}
    })();
    studentReads.set(key,entry);
    const cleanup=setTimeout(()=>{if(studentReads.get(key)===entry)studentReads.delete(key);},Math.max(1,entry.until-Date.now()));
    if (cleanup && typeof cleanup.unref==='function') cleanup.unref();
  }
  event.waitUntil(entry.task.then(result=>{
    port.postMessage(result);
    // No reutilizar respuestas ya completadas: una verificación nueva consulta servidor.
    if (studentReads.get(key)===entry) studentReads.delete(key);
  }));
});
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
