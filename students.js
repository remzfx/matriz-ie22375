/* Estudiantes: solo respuestas autorizadas del backend; caché temporal ligada al token exacto. */
(function (global) {
  'use strict';
  const KEY = 'ie22375_students_session_v1';
  const TTL = 10 * 60 * 1000;
  const API = 'https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
  let memory = null;
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
    return base;
  }
  function peek() {
    const token = validToken();
    if (!token) { clear(); return null; }
    try {
      const cached = memory || JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (cached && cached.token === token && cached.until > Date.now()) return JSON.parse(JSON.stringify(cached.base));
    } catch (e) {}
    clear();
    return null;
  }
  function remember(base, token) {
    memory = {token: token, until: Date.now() + TTL, base: JSON.parse(JSON.stringify(base))};
    try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {}
    return base;
  }
  async function request(action, data) {
    const token = validToken();
    if (!token) {
      clear(); status('Sesión ausente o vencida. Vuelve a iniciar sesión.');
      throw new Error('Sesión ausente o vencida. Vuelve a iniciar sesión.');
    }
    if (action === 'loadstudents') status('Cargando estudiantes con tu sesión…');
    let response;
    try {
      const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(Object.assign({}, data, {action: action, token: token})), cache: 'no-store'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      response = await r.json();
    } catch (e) {
      const cached = action === 'loadstudents' ? peek() : null;
      if (cached) {
        status('Sin conexión: lista temporal de esta sesión (máximo 10 minutos).');
        return Object.assign({}, cached, {offline: true});
      }
      status('No se pudo conectar. Revisa la conexión y recarga para cargar estudiantes.');
      throw new Error('No se pudo conectar para cargar/guardar estudiantes. Reintenta con conexión.');
    }
    // Nunca usar un fallback ante una denegación, ni guardar datos de una sesión que cambió.
    if (validToken() !== token || !response.ok) {
      clear();
      status(response.error || 'La sesión cambió. Vuelve a iniciar sesión.');
      throw new Error(response.error || 'La sesión cambió. Vuelve a iniciar sesión.');
    }
    if (!Array.isArray(response.estudiantes)) { clear(); throw new Error('Respuesta de estudiantes inválida.'); }
    status(response.inicializada ? (response.estudiantes.length + ' estudiantes cargados para tu sesión.') : 'La base oficial está pendiente de inicialización por Admin.');
    return remember(toBase(response), token);
  }
  global.IEStudents = {empty: empty, peek: peek, clear: clear, session: session,
    load: () => request('loadstudents'),
    save: (base, version) => request('savestudents', {base: base, version: version}),
    initialize: (base, version) => request('initstudents', {base: base, version: version}),
    restore: version => request('restorestudents', {version: version})};
})(window);
