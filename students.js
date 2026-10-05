/* Estudiantes: solo respuestas autorizadas del backend; caché temporal ligada al token exacto. */
(function (global) {
  'use strict';
  const KEY = 'ie22375_students_session_v1';
  const TTL = 10 * 60 * 1000;
  const API = 'https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
  let memory = null;
  const pending = new Map();
  function status(message) {
    const el = document.getElementById('studentsStatus');
    if (el) el.textContent = message;
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem('ie22375_session_v1') || localStorage.getItem('ie22375_session_v1') || 'null'); }
    catch (e) { return null; }
  }
  function validToken() {
    const s = session();
    if (!s || !s.token) return '';
    try {
      const p = s.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(p));
      return Number(claims.exp) > Date.now() ? s.token : '';
    } catch (e) { return ''; }
  }
  function clear() {
    memory = null;
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }
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
      const saved = memory || JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (saved && saved.token !== token) { clear(); return null; }
      const cached = saved && ((saved.entries || {})[scope] || saved);
      if (cached && cached.scope === scope && cached.until > Date.now()) return JSON.parse(JSON.stringify(cached.base));
    } catch (e) {}
    return null;
  }
  function remember(base, token, scope) {
    let prior = memory;
    try { prior = prior || JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch(e) {}
    const entries = prior && prior.token === token ? Object.assign({}, prior.entries || {}, prior.scope ? {[prior.scope]: {token:prior.token,scope:prior.scope,until:prior.until,base:prior.base}} : {}) : {};
    Object.keys(entries).forEach(k => { if (entries[k].until <= Date.now()) delete entries[k]; });
    const record = {token: token, scope: scope, until: Date.now() + TTL, base: JSON.parse(JSON.stringify(base))};
    entries[scope] = record;
    memory = Object.assign({}, record, {entries:entries});
    try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {}
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
  async function request(action, data) {
    data = data || {};
    const token = validToken(), scope = 'students:' + (data.bimestre || 'actual');
    if (!token) { clear(); throw error('SESSION','Sesión ausente o vencida. Vuelve a iniciar sesión.'); }
    const read = action === 'loadstudents', attempts = read ? 2 : 1;
    let last;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (validToken() !== token) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
      try {
        const response = await fetchJSON(API, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify(Object.assign({},data,{action:action,token:token})),cache:'no-store'});
        if (validToken() !== token) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
        if (!response || typeof response.ok !== 'boolean') throw error('INVALID_RESPONSE','Respuesta del servidor no válida.',true);
        if (!response.ok) {
          // Un backend antiguo/método incorrecto no verifica permisos. Solo lectura, nunca escritura.
          if (response.code === 'METHOD_NOT_ALLOWED' || /acción no válida/i.test(response.error || ''))
            throw error('API_INCOMPATIBLE','El backend no reconoce la lectura de estudiantes. Verifique la implementación de Apps Script.',true);
          throw error('DENIED',response.error || 'Sesión inválida o sin autorización.');
        }
        if (!Array.isArray(response.estudiantes)) throw error('INVALID_RESPONSE','Respuesta de estudiantes inválida.',true);
        return remember(toBase(response),token,scope);
      } catch(e) {
        last = e;
        if (validToken() !== token) throw error('SESSION','La sesión cambió. Vuelve a iniciar sesión.');
        if (!e.retryable) { clear(); status(e.message); throw e; }
        if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve,1200));
      }
    }
    const cached = read ? peek(scope) : null;
    if (cached) return Object.assign({},cached,{offline:true,verificationError:last.code});
    throw last;
  }
  function readOnce(data) {
    const key = validToken() + ':' + ((data || {}).bimestre || 'actual');
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
  global.IEStudents = {empty: empty, peek: () => peek('students:actual'),
    peekRoster: bimestre => ['I','II','III','IV'].includes(bimestre) ? peek('students:' + bimestre) : null,
    clear: clear, session: session, validToken: validToken, fetchJSON: fetchJSON,
    load: () => readOnce(),
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
