/* Estudiantes: solo respuestas autorizadas del backend; caché temporal ligada al token exacto. */
(function (global) {
  'use strict';
  const KEY = 'ie22375_students_session_v1';
  const TTL = 24 * 60 * 60 * 1000;
  const API = 'https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
  let memory = null, authorizationEpoch = 0;
  const pending = new Map();
  const latestRequest = new Map();
  let bridge = null;
  function startBridge() {
    if (!document.body && typeof document.addEventListener === 'function') return null;
    if (!session() || !['admin','docente','auxiliar'].includes(session().role)) return null;
    if (!bridge && validToken() && global.IELoginBridge) {
      try { bridge = global.IELoginBridge.create(API,'students'); } catch(e) {}
    }
    return bridge;
  }
  function status(message) {
    const el = document.getElementById('studentsStatus');
    if (el) el.textContent = message;
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem('ie22375_session_v1') || localStorage.getItem('ie22375_session_v1') || 'null'); }
    catch (e) { return null; }
  }
  function tokenExpiryMs(token) {
    try {
      const p = String(token || '').split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(p));
      return Number(claims.exp) || 0;
    } catch (e) { return 0; }
  }
  function validToken() {
    const s = session();
    if (!s || !s.token) return '';
    return tokenExpiryMs(s.token) > Date.now() ? s.token : '';
  }
  function clear() {
    authorizationEpoch++;
    memory = null;
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  // Propagar retirada de autorización entre pestañas sin borrar notas locales.
  if (typeof global.addEventListener === 'function') global.addEventListener('storage', function(e) {
    if ((e.key === KEY && !e.newValue) || e.key === 'ie22375_session_v1') clear();
  });
  function empty() { return {primaria: {estudiantes: [], docentes: []}, secundaria: {estudiantes: [], docentes: []}}; }
  function toBase(response) {
    const base = empty();
    response.estudiantes.forEach(function (al) {
      if (base[al.nivel]) base[al.nivel].estudiantes.push(al);
    });
    base.version = response.version;
    base.inicializada = response.inicializada;
    base.bimestre = response.bimestre || '';
    base.padronInicializado = response.padronInicializado !== false;
    base.fuentePadron = response.fuentePadron || '';
    return base;
  }
  function peek(scope) {
    const token = validToken();
    if (!token) { clear(); return null; }
    try {
      const saved = memory ||
        JSON.parse(sessionStorage.getItem(KEY) || 'null') ||
        JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.token !== token) { clear(); return null; }
      const cached = saved && ((saved.entries || {})[scope] || saved);
      if (cached && cached.token === token && cached.scope === scope && cached.until > Date.now() && cached.base.inicializada !== false) return JSON.parse(JSON.stringify(cached.base));
    } catch (e) {}
    return null;
  }
  function remember(base, token, scope) {
    let prior = memory;
    try { prior = prior || JSON.parse(sessionStorage.getItem(KEY) || 'null') || JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
    const entries = prior && prior.token === token ? Object.assign({}, prior.entries || {}, prior.scope ? {[prior.scope]: {token:prior.token,scope:prior.scope,until:prior.until,base:prior.base}} : {}) : {};
    Object.keys(entries).forEach(k => { if (entries[k].until <= Date.now()) delete entries[k]; });
    let until = Date.now() + TTL;
    try {
      const s = session();
      const exp = s && s.token ? tokenExpiryMs(s.token) : 0;
      if (exp) until = Math.min(until, exp);
      if (s && Number(s.tokenExp)) until = Math.min(until, Number(s.tokenExp));
    } catch(e) {}
    const record = {token: token, scope: scope, until: until, base: JSON.parse(JSON.stringify(base))};
    entries[scope] = record;
    memory = Object.assign({}, record, {entries:entries});
    try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {}
    return base;
  }
  function error(code, message, retryable) {
    const e = new Error(message); e.code = code; e.retryable = !!retryable; return e;
  }
  async function fetchJSON(url, options, timeout = 12000) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { if (ctrl) ctrl.abort(); reject(error('TIMEOUT','El servidor tardó demasiado.',true)); }, timeout);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const r = await fetch(url, Object.assign({}, options, ctrl ? {signal:ctrl.signal} : {}));
        if (!r.ok) throw error('HTTP','No se pudo conectar con el servidor.',r.status !== 401 && r.status !== 403);
        return await r.json();
      })()]);
    } catch(e) {
      if (e.code) throw e;
      throw error('NETWORK','No se pudo conectar para obtener una respuesta del servidor.',true);
    } finally { clearTimeout(timer); }
  }
  function workerMessage(worker,data,timeout) {
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(error('TIMEOUT','El servidor tardó demasiado.',true));},timeout);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      try {worker.postMessage(data,[channel.port2]);}
      catch(e){clearTimeout(timer);channel.port1.close();reject(error('NETWORK','No se pudo conectar con el servidor.',true));}
    });
  }
  async function preloadAvailable() {
    const worker=typeof navigator!=='undefined'&&navigator.serviceWorker&&navigator.serviceWorker.controller;
    if (!worker || typeof MessageChannel==='undefined') return null;
    try {return (await workerMessage(worker,{type:'IE_STUDENTS_PROBE_V1'},200)).supported ? worker : null;}catch(e){return null;}
  }
  async function studentsResponse(data,token,transport) {
    if (transport) return transport.loadStudents({token,bimestre:data.bimestre || ''});
    const worker=session()&&session().role==='auxiliar' ? await preloadAvailable() : null;
    if (worker) {
      const result=await workerMessage(worker,{type:'IE_STUDENTS_READ_V1',token,bimestre:data.bimestre||''},13000);
      if(result.error)throw error(result.error.code,result.error.message,result.error.retryable);
      return result.response;
    }
    return fetchJSON(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(Object.assign({},data,{action:'loadstudents',token})),cache:'no-store'});
  }
  async function request(action, data) {
    data = data || {};
    const token = validToken(), scope = 'students:' + (data.bimestre || 'actual');
    if (!token) { clear(); throw error('SESSION','Sesión ausente o vencida. Vuelve a iniciar sesión.'); }
    const epoch = authorizationEpoch;
    const requestId = (latestRequest.get(scope) || 0) + 1;
    latestRequest.set(scope, requestId);
    const read = action === 'loadstudents';
    const candidate = read ? startBridge() : null;
    const transport = candidate && (candidate.ready() || await candidate.whenReady()) ? candidate : null;
    const attempts = read && !transport ? 2 : 1;
    let last;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (validToken() !== token || epoch !== authorizationEpoch) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
      try {
        const response = read ? await studentsResponse(data,token,transport) : await fetchJSON(API, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify(Object.assign({},data,{action:action,token:token})),cache:'no-store'});
        if (validToken() !== token || epoch !== authorizationEpoch) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
        if (!response || typeof response.ok !== 'boolean') throw error('INVALID_RESPONSE','Respuesta del servidor no válida.',true);
        if (!response.ok) {
          // Un backend antiguo/método incorrecto no verifica permisos. Solo trabajo local previamente autorizado; nunca habilita subida a la nube.
          if (response.code === 'METHOD_NOT_ALLOWED' || /acción no válida/i.test(response.error || ''))
            throw error('API_INCOMPATIBLE','El backend no reconoce la lectura de estudiantes. Verifique la implementación de Apps Script.',true);
          const denied = error('DENIED',response.error || 'Sesión inválida o sin autorización.');
          denied.authorizationRejected = response.code === 'SESSION' || /sesión.*(?:inválida|vencida|autorización)/i.test(response.error || '');
          throw denied;
        }
        if (!Array.isArray(response.estudiantes)) throw error('INVALID_RESPONSE','Respuesta de estudiantes inválida.',true);
        if (read && data.bimestre && response.bimestre !== data.bimestre)
          throw error('INVALID_RESPONSE','El servidor no confirmó el bimestre solicitado.',true);
        // Una respuesta anterior nunca debe borrar datos que una petición más reciente ya confirmó.
        if (requestId !== latestRequest.get(scope)) return peek(scope) || toBase(response);
        if (session() && session().role==='auxiliar' && response.timing) {
          try {
            const datos=JSON.parse(sessionStorage.getItem('ie22375_aux_timing_v1')||'{}');
            ['authMs','studentsMs','totalMs'].forEach(k=>{const value=Number(response.timing[k]);if(Number.isFinite(value)&&value>=0)datos['backend_'+k]=value;});
            sessionStorage.setItem('ie22375_aux_timing_v1',JSON.stringify(datos));
          } catch(e) {}
        }
        return remember(toBase(response),token,scope);
      } catch(e) {
        last = e;
        if (validToken() !== token || epoch !== authorizationEpoch) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
        if (!e.retryable) { clear(); status(e.message); throw e; }
        if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve,1200));
      }
    }
    const cached = read ? peek(scope) : null;
    if (cached) return Object.assign({},cached,{offline:true,verificationError:last.code});
    throw last;
  }
  function readOnce(data) {
    const key = authorizationEpoch + ':' + validToken() + ':' + ((data || {}).bimestre || 'actual');
    if (!pending.has(key)) {
      const task = checkedLoad(data).finally(() => { if (pending.get(key) === task) pending.delete(key); });
      pending.set(key,task);
    }
    return pending.get(key);
  }
  async function checkedLoad(data) {
    const base = await request('loadstudents', data);
    if (!base.inicializada) { clear(); throw new Error('Base privada no inicializada. Admin debe completar la inicialización SIAGIE.'); }
    return base;
  }
  if (!document.body && typeof document.addEventListener === 'function') document.addEventListener('DOMContentLoaded',startBridge,{once:true});
  else startBridge();
  global.IEStudents = {empty: empty, peek: () => peek('students:actual'),
    peekRoster: bimestre => ['I','II','III','IV'].includes(bimestre) ? peek('students:' + bimestre) : null,
    clear: clear, session: session, validToken: validToken, fetchJSON: fetchJSON,
    load: () => readOnce(),
    // Sin coordinador no se precarga: evita una petición abandonada al navegar.
    preload: async () => {
      const token=validToken();
      if (!token || !session() || session().role!=='auxiliar' || !await preloadAvailable() || validToken()!==token) return null;
      return readOnce();
    },
    inspect: () => request('loadstudents'),
    loadRoster: bimestre => {
      if (!['I','II','III','IV'].includes(bimestre)) return Promise.reject(new Error('Bimestre inválido.'));
      return readOnce({bimestre: bimestre});
    },
    save: (base, version) => request('savestudents', {base: base, version: version}),
    initialize: (base, version) => request('initstudents', {base: base, version: version}),
    seedRoster: (version, bimestre) => request('seedstudentsroster', {version: version, bimestre: bimestre}),
    sync: (base, version, bimestre) => request('syncstudents', {base: base, version: version, bimestre: bimestre}),
    enrich: (version, bimestre, nivel, grado, seccion, identidades) => request('enrichstudents', {
      version: version, bimestre: bimestre, nivel: nivel, grado: grado, seccion: seccion, identidades: identidades
    }),
    restore: version => request('restorestudents', {version: version})};
})(window);
