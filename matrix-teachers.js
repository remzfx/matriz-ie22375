// Vista sanitizada de DOCENTE_ACCESOS, compartida por las dos matrices.
(function(global) {
  'use strict';
  const KEY = 'ie22375_matrix_teachers_v1', TTL = 10 * 60 * 1000;
  let memory = null;
  function clear() {
    memory = null;
    try { sessionStorage.removeItem(KEY); } catch(e) {}
  }
  function peek() {
    const token = global.IEStudents.validToken();
    if (!token) { clear(); return null; }
    try {
      const saved = memory || JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (saved && saved.token === token && saved.until > Date.now() && Array.isArray(saved.docentes)) return saved.docentes;
    } catch(e) {}
    return null;
  }
  async function load(api) {
    const token = global.IEStudents.validToken();
    if (!token) { clear(); throw new Error('Sesión ausente o vencida.'); }
    const response = await global.IEStudents.fetchJSON(api, {method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'loadmatrixteachers',token:token}),cache:'no-store'});
    if (global.IEStudents.validToken() !== token || !response || !response.ok) {
      clear(); throw new Error('No se pudo verificar la asignación administrativa.');
    }
    if (!Array.isArray(response.docentes)) throw new Error('Respuesta docente inválida.');
    // Segunda lista explícita en el cliente: solo guardar los campos de esta vista.
    const docentes = response.docentes.map(doc => {
      const out = {nombre:String(doc.nombre || ''),nivel:String(doc.nivel || ''),grados:Array.isArray(doc.grados) ? doc.grados : []};
      if (doc.asignaciones != null) {
        out.asignaciones = {};
        Object.keys(doc.asignaciones).forEach(area => { out.asignaciones[area] = Array.isArray(doc.asignaciones[area]) ? doc.asignaciones[area].map(String) : []; });
      } else {
        out.areas = Array.isArray(doc.areas) ? doc.areas.map(String) : [];
        out.aulas = Array.isArray(doc.aulas) ? doc.aulas.map(String) : [];
      }
      return out;
    });
    memory = {token:token,until:Date.now()+TTL,docentes:docentes};
    try { sessionStorage.setItem(KEY,JSON.stringify(memory)); } catch(e) {}
    return docentes;
  }
  function grado(value) {
    const nombres = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO'];
    const index = nombres.indexOf(String(value || '').toUpperCase());
    return index >= 0 ? index + 1 : parseInt(String(value || ''),10);
  }
  function seccion(value) { return String(value || '').trim().toUpperCase().replace(/Ú/g,'U'); }
  function nombre(nivel, value, section, area) {
    const docs = peek() || [], g = grado(value), sec = seccion(section);
    const found = docs.find(doc => {
      if (doc.nivel !== nivel) return false;
      if (nivel === 'primaria') return doc.grados.some(v => grado(v) === g);
      const aulas = doc.asignaciones != null ? doc.asignaciones[area] :
        ((doc.areas || []).includes(area) ? doc.aulas : []);
      return Array.isArray(aulas) && aulas.some(aula => {
        const parts = String(aula).split('|');
        return parts.length === 2 && grado(parts[0]) === g && seccion(parts[1]) === sec;
      });
    });
    const name = found ? String(found.nombre || '').trim() : '';
    return /^(Pendiente de verificar|Sin registrar)$/i.test(name) ? '' : name;
  }
  function exigirNombre(nivel, value, section, area) {
    if (!peek()) throw new Error('Espera mientras se verifica el docente responsable');
    const name = nombre(nivel, value, section, area);
    if (!name) throw new Error('No hay docente responsable registrado para esta asignación');
    return name;
  }
  global.IEMatrixTeachers = {peek:peek,load:load,nombre:nombre,exigirNombre:exigirNombre};
})(window);
