/* Etapa A: preparación manual aislada; no cambia la base usada por los módulos actuales. */
(function(global) {
  'use strict';
  const listas = {primaria: null, secundaria: null};
  let ocupada = false;

  // Read-only presentation state. Never used to authorize a write or change its payload.
  let baseComparacion = null;
  function texto(id, value) { const el=document.getElementById(id);if(el)el.textContent=value; }
  function compararMatricula(actual, nuevas) {
    const result={continuan:0,nuevos:0,trasladados:nuevas.filter(a=>String(a.estadoMatricula||'').toUpperCase()==='TRASLADADO').length,ausentes:0,inconsistentes:0,noVerificados:0};
    const ids=a=>[a.idSiagie?'id:'+String(a.idSiagie).trim():null,a.codigoEstudiante?'cod:'+String(a.codigoEstudiante).trim():null].filter(Boolean);
    const index=new Map();actual.forEach((a,i)=>ids(a).forEach(k=>{const set=index.get(k)||new Set();set.add(i);index.set(k,set);}));
    const incoming=new Map();nuevas.forEach((a,i)=>ids(a).forEach(k=>{const set=incoming.get(k)||new Set();set.add(i);incoming.set(k,set);}));
    const seen=new Set(),unknownBase=actual.some(a=>!ids(a).length);
    nuevas.forEach(a=>{
      const keys=ids(a),matches=new Set();keys.forEach(k=>(index.get(k)||[]).forEach(i=>matches.add(i)));
      if(keys.some(k=>incoming.get(k).size>1)||matches.size>1||!a.nombre||!a.grado||!a.seccion){result.inconsistentes++;return;}
      if(!keys.length){result.noVerificados++;return;}
      if(matches.size===1){const i=[...matches][0],old=actual[i];if(a.idSiagie&&old.idSiagie&&String(a.idSiagie).trim()!==String(old.idSiagie).trim()){result.inconsistentes++;return;}seen.add(i);result.continuan++;}
      else if(unknownBase)result.noVerificados++;else result.nuevos++;
    });
    result.ausentes=result.noVerificados||result.inconsistentes||unknownBase?null:actual.length-seen.size;
    return result;
  }
  function pintarComparacion() {
    if(!listas.primaria||!listas.secundaria){texto('gestionComparacion','Selecciona y revisa ambos CSV. Comparación: No verificado.');return;}
    if(!baseComparacion){texto('gestionComparacion','CSV listos: Primaria '+listas.primaria.length+' · Secundaria '+listas.secundaria.length+'. Continúan, nuevos y ausentes: No verificado. Consulta la base en el servidor.');return;}
    const out=['primaria','secundaria'].map(n=>{const r=compararMatricula(baseComparacion[n].estudiantes,listas[n]);return (n==='primaria'?'Primaria':'Secundaria')+': Continúan '+r.continuan+' · Nuevos '+(r.noVerificados?'No verificado':r.nuevos)+' · Trasladados en CSV '+r.trasladados+' · Ya no aparecen '+(r.ausentes===null?'No verificado':r.ausentes)+' · Duplicados/inconsistentes '+r.inconsistentes+' · Identidades por revisar '+r.noVerificados;});
    texto('gestionComparacion',out.join('\n')+'\nComparación informativa por ID/código; no asocia nombres parecidos ni actualiza datos.');
  }
  function mostrarBase(base, verificada, fallo) {
    const valid=!!(base&&base.inicializada&&base.primaria&&base.secundaria);
    baseComparacion=valid&&verificada&&!base.offline?JSON.parse(JSON.stringify(base)):null;
    ['primaria','secundaria'].forEach(n=>texto(n==='primaria'?'gestionPrimaria':'gestionSecundaria',valid?base[n].estudiantes.length+' estudiantes'+(baseComparacion?' · servidor':' · caché, no verificado'):'No verificado'));
    texto('gestionServidor',fallo?'Error · '+fallo:baseComparacion?'Verificado en esta consulta':base&&base.inicializada===false?'Disponible · base pendiente de inicialización':valid?'Caché · servidor no verificado':'No verificado');
    pintarComparacion();
  }
  function bimestreVista(value) {
    ['migracionBimestre','gestionBimestre'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=value;});
    texto('gestionPadronEstado','Bimestre '+value+' · Estado y cantidad: No verificado. Consulta el padrón.');
    const button=document.getElementById('gestionCrearPadron');if(button)button.hidden=true;
  }
  async function mostrarPadron(base,bim) {
    const button=document.getElementById('gestionCrearPadron');if(button)button.hidden=true;
    let estado='No verificado';
    const api=typeof CLOUD_API_URL!=='undefined'?CLOUD_API_URL:global.CLOUD_API_URL;
    if(api&&IEStudents.fetchJSON)try{const response=await IEStudents.fetchJSON(api+'?action=loadperiodos',{cache:'no-store'});if(response.ok&&response.periodos&&response.periodos.bimestres)estado=response.periodos.bimestres[bim]||'No verificado';}catch(e){}
    if(bimestreSeleccionado()!==bim)return;
    const total=base.primaria.estudiantes.length+base.secundaria.estudiantes.length;
    texto('gestionPadronEstado','Bimestre '+bim+' · '+estado+' · '+(base.padronInicializado?'Padrón verificado: '+total+' estudiantes':'Sin padrón propio; base vigente: '+total+' estudiantes')+'.');
    if(button)button.hidden=!(estado==='abierto'&&base.inicializada&&!base.padronInicializado);
  }

  function mensaje(text) { document.getElementById('migracionEstado').textContent = text; }
  async function importar(input, nivel) {
    if (ocupada) return;
    listas[nivel] = null;
    document.getElementById('migracionRevisada').checked = false;
    const file = input.files && input.files[0];
    if (!file) return;
    ocupada = true;
    try {
      const text = await file.text();
      // No usar la copia empotrada, localStorage ni exportaciones antiguas de la plataforma como semilla.
      if (!/ApellidoPaterno/i.test(text) || !/NumeroDeOrden|ITEM/i.test(text) || !/EstadoMatricula/i.test(text)) {
        throw new Error('Selecciona un CSV SIAGIE vigente con cabeceras de matrícula, no la base antigua de la plataforma.');
      }
      const destino = document.getElementById('importNivel');
      const anterior = destino.value;
      let list;
      try { destino.value = nivel; list = global.parseCSV(text, {includeTransferred: true}); }
      finally { destino.value = anterior; }
      if (!list.length || list.some(a => a.nivel !== nivel)) throw new Error('Revisa el nivel y los alumnos del archivo SIAGIE.');
      listas[nivel] = list;
      document.getElementById('migracionPreview-' + nivel).textContent = list.map(a => a.grado + '° ' + a.seccion + ' · ' + a.orden + ' · ' + a.nombre).join('\n');
      mensaje('Borrador SIAGIE: Primaria ' + (listas.primaria || []).length + ' · Secundaria ' + (listas.secundaria || []).length + '. Revisa ambas listas antes de confirmar.');
    } catch(e) {
      document.getElementById('migracionPreview-' + nivel).textContent = '';
      mensaje(e.message);
    } finally { ocupada = false; pintarComparacion(); }
  }
  async function verificar() {
    if (ocupada) return;
    ocupada = true;
    mensaje('Verificando la base privada en el servidor…');
    try {
      const base = await (IEStudents.inspect || IEStudents.load)();
      if (base.offline) throw new Error('La verificación requiere conexión; una caché no confirma producción.');
      mostrarBase(base, true);
      if (base.inicializada) {
        ['primaria', 'secundaria'].forEach(nivel => {
          // A server check must not replace the selected CSV draft preview.
          if (listas[nivel]) return;
          document.getElementById('migracionPreview-' + nivel).textContent = base[nivel].estudiantes.map(a => a.grado + '° ' + a.seccion + ' · ' + a.orden + ' · ' + a.nombre).join('\n');
        });
      }
      mensaje(base.inicializada ? 'Base privada inicializada: Primaria ' + base.primaria.estudiantes.length + ' · Secundaria ' + base.secundaria.estudiantes.length + '. Confirma estos datos antes de autorizar la etapa B.' : 'Backend disponible. Hoja privada pendiente de la importación SIAGIE revisada.');
    } catch(e) { mostrarBase(null, false, e.message); mensaje(e.message); }
    finally { ocupada = false; }
  }
  function bimestreSeleccionado() {
    const el = document.getElementById('migracionBimestre');
    const bim = String(el && el.value || '').trim().toUpperCase();
    if (!/^(I|II|III|IV)$/.test(bim)) throw new Error('Selecciona el bimestre que corresponde a esta lista SIAGIE.');
    return bim;
  }
  async function verificarPadron() {
    if (ocupada) return;
    ocupada = true;
    try {
      const bim = bimestreSeleccionado();
      mensaje('Verificando padrón del bimestre ' + bim + '…');
      texto('gestionPadronEstado','Consultando padrón '+bim+' · No verificado…');
      const button=document.getElementById('gestionCrearPadron');if(button)button.hidden=true;
      const base = await IEStudents.loadRoster(bim);
      if (base.offline) throw new Error('La verificación del padrón requiere conexión.');
      if (!base.inicializada) throw new Error('La base privada todavía no está inicializada.');
      await mostrarPadron(base,bim);
      mensaje(base.padronInicializado
        ? 'Padrón ' + bim + ' guardado en servidor: Primaria ' + base.primaria.estudiantes.length + ' · Secundaria ' + base.secundaria.estudiantes.length + '.'
        : 'El bimestre ' + bim + ' todavía no tiene padrón propio. La base vigente tiene Primaria ' + base.primaria.estudiantes.length + ' · Secundaria ' + base.secundaria.estudiantes.length + '.');
    } catch(e) { texto('gestionPadronEstado','No verificado · '+e.message);mensaje(e.message); }
    finally { ocupada = false; }
  }
  async function crearPadron() {
    if (ocupada) return;
    ocupada = true;
    try {
      const bim = bimestreSeleccionado();
      const actual = await (IEStudents.inspect || IEStudents.load)();
      if (actual.offline) throw new Error('La creación del padrón requiere conexión.');
      if (!actual.inicializada) throw new Error('Primero inicializa la base privada.');
      if (!confirm('¿Crear el padrón del bimestre ' + bim + ' desde la base SIAGIE vigente? Si ya existe, no se reemplazará.')) return;
      const padron = await IEStudents.seedRoster(actual.version, bim);
      mensaje('Padrón ' + bim + ' listo: Primaria ' + padron.primaria.estudiantes.length + ' · Secundaria ' + padron.secundaria.estudiantes.length + '.');
    } catch(e) { mensaje(e.message); }
    finally { ocupada = false; }
  }
  async function sincronizarPadron() {
    if (ocupada) return;
    if (!listas.primaria || !listas.secundaria || !document.getElementById('migracionRevisada').checked) {
      mensaje('Importa ambos CSV SIAGIE vigentes y confirma que revisaste las dos listas.'); return;
    }
    ocupada = true;
    try {
      const bim = bimestreSeleccionado();
      const actual = await (IEStudents.inspect || IEStudents.load)();
      if (actual.offline) throw new Error('La actualización requiere conexión al backend.');
      if (!actual.inicializada) throw new Error('Primero inicializa la base privada.');
      const totalAntes = actual.primaria.estudiantes.length + actual.secundaria.estudiantes.length;
      const totalNuevo = listas.primaria.length + listas.secundaria.length;
      if (!confirm('¿Actualizar la base SIAGIE vigente y el padrón del bimestre ' + bim + '?\n\nActual: ' + totalAntes + ' estudiantes · Nueva lista: ' + totalNuevo + '.\n\nLas notas ya guardadas no se modifican; los alumnos que ya no estén en esta lista dejarán de aparecer en el padrón activo del bimestre.')) return;
      const base = await IEStudents.sync(
        {primaria: {estudiantes: listas.primaria}, secundaria: {estudiantes: listas.secundaria}},
        actual.version, bim
      );
      mensaje('Actualización SIAGIE aplicada al bimestre ' + bim + ': Primaria ' + base.primaria.estudiantes.length + ' · Secundaria ' + base.secundaria.estudiantes.length + '. Las notas existentes permanecen intactas.');
    } catch(e) { mensaje(e.message); }
    finally { ocupada = false; }
  }

  async function inicializar() {
    if (ocupada) return;
    if (!listas.primaria || !listas.secundaria || !document.getElementById('migracionRevisada').checked) {
      mensaje('Importa ambos CSV SIAGIE vigentes y confirma que revisaste las dos listas.'); return;
    }
    if (!confirm('¿Inicializar una sola vez la base privada y su respaldo con estas dos listas SIAGIE revisadas? Se conservarán las notas académicas existentes.')) return;
    ocupada = true;
    try {
      const actual = await (IEStudents.inspect || IEStudents.load)();
      if (actual.offline) throw new Error('La inicialización requiere conexión al backend.');
      if (actual.inicializada) throw new Error('La base privada ya está inicializada. No se reemplazará durante la migración.');
      await IEStudents.initialize({primaria: {estudiantes: listas.primaria}, secundaria: {estudiantes: listas.secundaria}}, actual.version);
      mensaje('Base privada y respaldo inicializados desde SIAGIE revisado. Verifica los datos y padrones en el servidor.');
    } catch(e) { mensaje(e.message); }
    finally { ocupada = false; }
  }
  global.IEMigrateStudents = {compararMatricula: compararMatricula, mostrarBase: mostrarBase, bimestreVista: bimestreVista, importar: importar, verificar: verificar, verificarPadron: verificarPadron, crearPadron: crearPadron, sincronizarPadron: sincronizarPadron, inicializar: inicializar};
})(window);
