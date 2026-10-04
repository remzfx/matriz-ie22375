/* Identidad de alumnos y lectura compatible de notas; no contiene datos del padrón. */
(function(global) {
  'use strict';
  function normalizarNombre(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function studentKey(al) {
    if (al && String(al.idSiagie || '').trim()) return 'id:' + encodeURIComponent(String(al.idSiagie).trim());
    if (al && String(al.codigoEstudiante || '').trim()) return 'cod:' + encodeURIComponent(String(al.codigoEstudiante).trim());
    return 'nom:' + encodeURIComponent(normalizarNombre(al && al.nombre));
  }
  function identidades(al) {
    const out=[studentKey(al)];
    if (al.codigoEstudiante) out.push('cod:'+encodeURIComponent(String(al.codigoEstudiante).trim()));
    out.push('nom:'+encodeURIComponent(normalizarNombre(al.nombre)));
    return [...new Set(out)];
  }
  function recordar(mapa, al) {
    const keys=identidades(al).filter(k=>!k.startsWith('nom:')||k===studentKey(al)), nombres=new Set([al.nombre]);
    keys.forEach(k=>(mapa[k]||[]).forEach(n=>nombres.add(n)));
    keys.forEach(k=>mapa[k]=[...nombres]);
  }
  function leer(mapa, key, al, aliases, permitirNombre = true) {
    if (!mapa || !al || !key) return undefined;
    const prefix=key.slice(0,key.lastIndexOf('||')+2), ids=identidades(al);
    const nombres=new Set([normalizarNombre(al.nombre)]);
    ids.forEach(id=>((aliases||{})[id]||[]).forEach(n=>nombres.add(normalizarNombre(n))));
    // Una identidad nueva no hereda por nombre las notas de otra identidad ya conocida.
    const otroDueno=Object.entries(aliases||{}).some(([id,lista])=>
      /^(id:|cod:)/.test(id)&&!ids.includes(id)&&Array.isArray(lista)&&lista.some(n=>nombres.has(normalizarNombre(n))));
    permitirNombre=permitirNombre&&!otroDueno;
    for (const id of ids) {
      if (!permitirNombre && id.startsWith('nom:')) continue;
      const k=prefix+id;
      if (Object.prototype.hasOwnProperty.call(mapa,k)) return mapa[k] && mapa[k].borrado ? undefined : mapa[k];
    }
    if (!permitirNombre) return undefined;
    const matches=Object.keys(mapa).filter(k=>k.startsWith(prefix)&&!/^id:|^cod:|^nom:/.test(k.slice(prefix.length))&&nombres.has(normalizarNombre(k.slice(prefix.length))));
    // No asociar por nombre cuando hay más de una clave candidata: requiere revisión de identidad.
    if(matches.length!==1)return undefined;
    const record=mapa[matches[0]];return record&&record.borrado?undefined:record;
  }
  global.studentKey=studentKey;
  global.IEStudentIdentity={normalizarNombre,recordar,leer};
})(window);
