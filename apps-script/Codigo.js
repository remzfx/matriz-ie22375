/**
 * Matriz IE 22375 — API Google Sheets
 * Guardado POR ÁREA (no pisa otras áreas) — v2
 *
 * 1) Pega este código completo en Apps Script
 * 2) Guardar
 * 3) Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar
 */

const HOJA_AREAS = 'EstadosAreas';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_SECRET_PROPERTY = 'IE22375_TOKEN_SECRET';
const ADMIN_PASS_PROPERTY = 'IE22375_ADMIN_PASS';
const AUXILIAR_PASS_PROPERTY = 'IE22375_AUXILIAR_PASS';
const PIP_PASS_PROPERTY = 'IE22375_PIP_PASS';
const DOCENTES_CACHE_KEY = 'IE22375_DOCENTE_ACCESOS_V1';
const DOCENTES_CACHE_TTL_SECONDS = 21600;
const ESTUDIANTES_CACHE_PREFIX = 'IE22375_ESTUDIANTES_V1_';
const ESTUDIANTES_CACHE_TTL_SECONDS = 21600;

function asegurarAsis_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('AsistenciaIngreso');
  if (!sh) {
    sh = ss.insertSheet('AsistenciaIngreso');
    sh.appendRow(['clave', 'fecha', 'nivel', 'grado', 'seccion', 'nombre', 'marca', 'hora', 'via', 'ts', 'motivo']);
    sh.getRange(1, 1, 1, 11).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < 11) {
    sh.getRange(1, 11).setValue('motivo').setFontWeight('bold');
  }
  return sh;
}

function asegurarWa_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('WhatsappGrupos');
  if (!sh) {
    sh = ss.insertSheet('WhatsappGrupos');
    sh.appendRow(['clave', 'ts', 'json']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function asegurarDoc_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('DocentesAcceso');
  if (!sh) {
    sh = ss.insertSheet('DocentesAcceso');
    sh.appendRow(['clave', 'ts', 'json']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leerDocentesConfigCache_() {
  try {
    const raw = CacheService.getScriptCache().get(DOCENTES_CACHE_KEY);
    if (raw) {
      const config = JSON.parse(raw);
      if (config && Array.isArray(config.docentes) &&
          typeof config.ts === 'number' && isFinite(config.ts)) return config;
    }
  } catch (err) { /* Caché no disponible o inválida: consultar Sheets. */ }
  return null;
}

function obtenerDocentesConfig_() {
  let config = leerDocentesConfigCache_();
  if (config) return config;
  // Solo los misses comparten bloqueo con savedoc; los hits no se serializan.
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    config = leerDocentesConfigCache_();
    if (config) return config;
    config = leerDocentesConfigSheets_();
    try {
      CacheService.getScriptCache().put(
        DOCENTES_CACHE_KEY, JSON.stringify(config), DOCENTES_CACHE_TTL_SECONDS
      );
    } catch (err) { /* Si excede el límite de caché, Sheets sigue siendo la fuente. */ }
    return config;
  } finally {
    lock.releaseLock();
  }
}

function obtenerDocentesConfigLectura_() {
  // No publicar un miss: savedoc podría invalidar la caché durante esta lectura.
  return leerDocentesConfigCache_() || leerDocentesConfigSheets_(true);
}

function leerDocentesConfigSheets_(soloLectura) {
  const sh = soloLectura ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DocentesAcceso') : asegurarDoc_();
  if (!sh) return { docentes: [], ts: 0 };
  const last = sh.getLastRow();
  if (last < 2) return { docentes: [], ts: 0 };
  const data = sh.getRange(2, 1, last - 1, 3).getValues();
  let best = null;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== 'DOCENTE_ACCESOS') continue;
    const ts = Number(data[i][1]) || 0;
    if (!best || ts >= best.ts) {
      let list = [];
      try {
        const raw = data[i][2];
        if (typeof raw === 'string' && raw) list = JSON.parse(raw);
        else if (Array.isArray(raw)) list = raw;
      } catch (err) { list = []; }
      best = { ts: ts, docentes: Array.isArray(list) ? list : [] };
    }
  }
  return best || { docentes: [], ts: 0 };
}

function normalizarUsuario_(value) {
  return String(value || '').trim().toLowerCase().replace(/^@+/, '');
}

function secretoToken_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(TOKEN_SECRET_PROPERTY);
  if (!secret) {
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      secret = props.getProperty(TOKEN_SECRET_PROPERTY);
      if (!secret) {
        secret = Utilities.getUuid() + Utilities.getUuid();
        props.setProperty(TOKEN_SECRET_PROPERTY, secret);
      }
    } finally {
      lock.releaseLock();
    }
  }
  return secret;
}

function base64UrlTexto_(value) {
  return Utilities.base64EncodeWebSafe(
    Utilities.newBlob(String(value)).getBytes()
  ).replace(/=+$/, '');
}

function firmarToken_(claims) {
  const payload = base64UrlTexto_(JSON.stringify(claims));
  const firma = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, secretoToken_(), Utilities.Charset.UTF_8)
  ).replace(/=+$/, '');
  return payload + '.' + firma;
}

function compararSeguro_(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  let diff = aa.length ^ bb.length;
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) diff |= (aa.charCodeAt(i) || 0) ^ (bb.charCodeAt(i) || 0);
  return diff === 0;
}

function validarToken_(token, role, docentesConfig) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const firma = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], secretoToken_(), Utilities.Charset.UTF_8)
  ).replace(/=+$/, '');
  if (!compararSeguro_(firma, parts[1])) return null;
  let claims = null;
  try {
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) { return null; }
  if (!claims || Number(claims.exp) <= Date.now()) return null;
  if (role && String(claims.role) !== String(role)) return null;
  if (claims.role === 'docente' && docentesConfig !== false) {
    const config = docentesConfig || obtenerDocentesConfig_();
    if (Number(claims.permisosVersion) !== Number(config.ts)) return null;
  }
  if (claims.role === 'auxiliar') {
    const config = obtenerAuxiliaresConfig_();
    const auxiliar = config.auxiliares.find(function(a) { return a.user === normalizarUsuario_(claims.user); });
    if (!auxiliar || auxiliar.activo !== true || !nivelesAuxiliar_(auxiliar.niveles).length || Number(claims.permisosVersion) !== config.ts) return null;
    claims.niveles = nivelesAuxiliar_(auxiliar.niveles);
  }
  return claims;
}

function obtenerAuxiliaresConfig_() {
  const sh = asegurarConfig_(), last = sh.getLastRow();
  let best = {auxiliares:[], ts:0};
  if (last < 2) return best;
  sh.getRange(2,1,last-1,3).getValues().forEach(function(row) {
    if (String(row[0]) !== 'AUXILIAR_ACCESOS' || Number(row[1]) < best.ts) return;
    try { const list = JSON.parse(row[2]); if (Array.isArray(list)) best = {auxiliares:list,ts:Number(row[1]) || 0}; } catch(e) {}
  });
  return best;
}
function nivelesAuxiliar_(niveles) {
  return ['primaria','secundaria'].filter(function(n) { return Array.isArray(niveles) && niveles.indexOf(n) >= 0; });
}
function autorizaNivelAuxiliar_(sesion, nivel) {
  return ['primaria','secundaria'].indexOf(nivel) >= 0 && !!sesion &&
    (sesion.role === 'admin' || (sesion.role === 'auxiliar' && nivelesAuxiliar_(sesion.niveles).indexOf(nivel) >= 0));
}
function hashAuxiliarPass_(user, pass) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(
    'auxiliar-password:' + normalizarUsuario_(user) + ':' + pass, secretoToken_(), Utilities.Charset.UTF_8)).replace(/=+$/, '');
}
function respuestaAuxiliares_(config) {
  return {ok:true,version:config.ts,auxiliares:config.auxiliares.map(function(a) {
    return {user:a.user,nombre:a.nombre,niveles:nivelesAuxiliar_(a.niveles),activo:a.activo === true};
  }),legacyPendiente:config.ts === 0 && !!PropertiesService.getScriptProperties().getProperty(AUXILIAR_PASS_PROPERTY)};
}
function guardarAuxiliar_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const config = obtenerAuxiliaresConfig_();
    if (Number(body.version) !== config.ts) return {ok:false,code:'CONFLICT',error:'La configuración cambió. Vuelve a cargar auxiliares.'};
    const input = body.auxiliar || {}, user = normalizarUsuario_(input.user);
    if (!/^[a-z0-9._@-]{1,80}$/.test(user) || ['admin','pip'].indexOf(user) >= 0) return {ok:false,error:'Usuario inválido.'};
    const prev = config.auxiliares.find(function(a) { return a.user === user; });
    const list = config.auxiliares.filter(function(a) { return a.user !== user; });
    if (!body.eliminar) {
      const niveles = nivelesAuxiliar_(input.niveles), nombre = String(input.nombre || '').trim();
      if (!nombre || nombre.length > 120 || !Array.isArray(input.niveles) || input.niveles.some(function(n) { return ['primaria','secundaria'].indexOf(n) < 0; }) || (input.activo === true && !niveles.length))
        return {ok:false,error:'Indica nombre y al menos un nivel para un auxiliar activo.'};
      let passHash = prev && prev.passHash;
      const pass = String(input.password || '').trim();
      if (pass) passHash = hashAuxiliarPass_(user,pass);
      else if (!prev && input.usarClaveAnterior === true && user === 'auxiliar') {
        const anterior = PropertiesService.getScriptProperties().getProperty(AUXILIAR_PASS_PROPERTY);
        if (anterior) passHash = hashAuxiliarPass_(user,anterior);
      }
      if (!passHash) return {ok:false,error:'Indica una contraseña o autoriza migrar la cuenta auxiliar antigua.'};
      list.push({user:user,nombre:nombre,niveles:niveles,activo:input.activo === true,passHash:passHash});
    } else if (!prev) return {ok:false,error:'Auxiliar inexistente.'};
    const ts = Math.max(Date.now(),config.ts + 1), sh = asegurarConfig_();
    sh.appendRow(['AUXILIAR_ACCESOS',ts,JSON.stringify(list)]);
    return respuestaAuxiliares_({ts:ts,auxiliares:list});
  } finally { lock.releaseLock(); }
}


function responderLogin_(body) {
  const tipo = String(body.tipo || '').toLowerCase();
  const usuario = normalizarUsuario_(body.usuario);
  const pass = String(body.password == null ? '' : body.password).trim();
  if (!pass || (['docente', 'admin', 'auxiliar', 'pip'].indexOf(tipo) < 0)) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }

  // Admin y PIP no dependen de configuraciones de cuentas; Auxiliar usa su configuración privada.
  // Evitar Sheets/CacheService en esos logins reduce la latencia del inicio.
  let config = null;
  let perfil = null;
  if (tipo === 'admin') {
    const adminPass = PropertiesService.getScriptProperties().getProperty(ADMIN_PASS_PROPERTY);
    if (usuario === 'admin' && adminPass && compararSeguro_(pass, adminPass)) {
      perfil = {
        user: 'admin', label: 'Administrador', role: 'admin', nivel: 'admin', grados: null,
        areas: null, aulas: null, asignaciones: null,
        mods: ['admin_bd', 'registro', 'auxiliar', 'wa_grupos', 'matriz_pri', 'matriz_sec', 'aip']
      };
    }
  } else if (tipo === 'auxiliar') {
    config = obtenerAuxiliaresConfig_();
    const auxiliar = config.auxiliares.find(function(a) { return a.user === usuario && a.activo === true; });
    if (auxiliar && nivelesAuxiliar_(auxiliar.niveles).length && compararSeguro_(hashAuxiliarPass_(usuario,pass),auxiliar.passHash)) {
      const niveles = nivelesAuxiliar_(auxiliar.niveles);
      perfil = {user:auxiliar.user,label:auxiliar.nombre,role:'auxiliar',niveles:niveles,
        nivel:niveles.length === 1 ? niveles[0] : 'multiple',mods:['auxiliar','wa_grupos']};
    }
  } else if (tipo === 'pip') {
    const password = PropertiesService.getScriptProperties().getProperty(PIP_PASS_PROPERTY);
    if (usuario === 'pip' && password && compararSeguro_(pass,password))
      perfil = {user:'pip',label:'Innovación',role:'pip',nivel:'colegio',grados:null,areas:null,aulas:null,asignaciones:null,mods:['aip']};
  } else {
    // Solo el login docente necesita cargar la configuración de accesos.
    config = obtenerDocentesConfig_();
    const docente = config.docentes.find(function (item) {
      return normalizarUsuario_(item.user) === usuario &&
        compararSeguro_(String(item.pass == null ? '' : item.pass).trim(), pass);
    });
    if (docente) {
      const nivel = String(docente.nivel || '').toLowerCase();
      const primaria = nivel === 'primaria' ? asignacionesPrimaria_(docente) : null;
      const aulasPrimaria = primaria ? [...new Set(Object.keys(primaria).reduce(function(out, area) { return out.concat(primaria[area]); }, []))] : [];
      perfil = {
        user: docente.user,
        label: docente.nombre || docente.user,
        role: 'docente',
        nivel: nivel,
        grados: nivel === 'primaria' ? [...new Set(aulasPrimaria.map(function(a) { return gradoEscritura_(a.split('|')[0]); }))] : null,
        areas: nivel === 'primaria' ? Object.keys(primaria) : (docente.areas || []),
        aulas: nivel === 'primaria' ? aulasPrimaria : (docente.aulas || []),
        asignaciones: nivel === 'primaria' ? primaria : (docente.asignaciones || null),
        tutorAulas: nivel === 'secundaria' ? tutorAulas_(docente) : [],
        mods: nivel === 'primaria' ? ['registro', 'matriz_pri'] : ['registro', 'matriz_sec']
      };
    }
  }
  if (!perfil) return { ok: false, error: 'Usuario o contraseña incorrectos.' };

  const now = Date.now();
  const exp = now + TOKEN_TTL_MS;
  const token = firmarToken_({
    user: perfil.user,
    role: perfil.role,
    nivel: perfil.nivel,
    niveles: perfil.niveles || null,
    permisosVersion: config ? config.ts : 0,
    iat: now,
    exp: exp
  });
  perfil.ok = true;
  perfil.token = token;
  perfil.tokenExp = exp;
  perfil.permisosVersion = config ? config.ts : 0;
  return perfil;
}

// Única función pública RPC del bridge: conserva íntegra la autenticación existente.
function loginBridgeAutenticar(body) {
  return responderLogin_(body || {});
}

// RPC de solo lectura; ignora cualquier acción suministrada por el cliente.
function studentsBridgeCargar(body) {
  body = body || {};
  return estudiantesRuta_({action:'loadstudents',token:body.token,bimestre:body.bimestre || ''});
}

function transversalesBridgeEjecutar(body) { return transversalesRuta_(body || {}); }
function loginBridgeVista_(p) {
  const origins = ['https://matriz.biblioteca360.com','https://biblioteca360.com','https://www.biblioteca360.com','https://remzfx.github.io'];
  if (origins.indexOf(p.parentOrigin) < 0 || !/^[a-f0-9]{32}$/.test(String(p.nonce || ''))) return responder_({ok:false,error:'Bridge inválido.'});
  const config = JSON.stringify({origin:p.parentOrigin,nonce:p.nonce,mode:p.bridge === 'students-v1' ? 'students' : p.bridge === 'transversales-v1' ? 'transversales' : 'login'});
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"></head><body><script>(' +
    loginBridgeFrame_.toString() + ')(' + config + ');</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle('Acceso IE22375');
}

function loginBridgeFrame_(config) {
  const channel = 'IE22375_LOGIN_BRIDGE_V1';
  let parent = null, lastId = 0, busy = false;
  function ancestor(source) {
    try {
      let node = window;
      for (let i=0; i<5 && node.parent !== node; i++) { node=node.parent; if (node === source) return true; }
    } catch(e) {}
    return false;
  }
  function reply(type, id, result) {
    if (parent) parent.postMessage({channel:channel,type:type,nonce:config.nonce,id:id,result:result},config.origin);
  }
  window.addEventListener('message',function(event) {
    const data = event.data;
    if (event.origin !== config.origin || !ancestor(event.source) || !data || data.channel !== channel || data.nonce !== config.nonce) return;
    if (parent && event.source !== parent) return;
    if (data.type === 'init' && !parent) { parent=event.source;reply('ack');return; }
    const students = config.mode === 'students';
    const transversal = config.mode === 'transversales';
    if (!parent || data.type !== (transversal ? 'transversales' : students ? 'students' : 'login') || (!students && !transversal && busy) || !Number.isSafeInteger(data.id) || data.id <= lastId) return;
    const body = data.body;
    if (!body || (transversal ? typeof body.token !== 'string' || typeof body.action !== 'string' : students ? typeof body.token !== 'string' || typeof body.bimestre !== 'string' : typeof body.tipo !== 'string' || typeof body.usuario !== 'string' || typeof body.password !== 'string')) return;
    lastId=data.id;busy=true;
    const id=data.id;
    try {
      const runner = google.script.run.withSuccessHandler(function(result) { busy=false;reply('result',id,result); })
        .withFailureHandler(function() { busy=false;reply('error',id); });
      if (transversal) runner.transversalesBridgeEjecutar(body);
      else if (students) runner.studentsBridgeCargar({token:body.token,bimestre:body.bimestre});
      else runner.loginBridgeAutenticar({tipo:body.tipo,usuario:body.usuario,password:body.password});
    } catch(e) { busy=false;reply('error',id); }
  });
  // HtmlService añade un sandbox interior. Solo el ancestro del origen permitido recibe READY.
  let target=window;
  for (let i=0; i<5 && target.parent !== target; i++) {
    target=target.parent;
    target.postMessage({channel:channel,type:'ready',nonce:config.nonce},config.origin);
  }
}

function gradoEscritura_(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  const nombres = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO'];
  const ordinal = nombres.indexOf(raw);
  if (ordinal >= 0) return ordinal + 1;
  return /^[1-6]°?$/.test(raw) ? Number(raw.replace('°', '')) : 0;
}

function seccionEscritura_(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  if (raw === 'UNICA' || raw === 'ÚNICA') return 'ÚNICA';
  return /^[A-Z]$/.test(raw) ? raw : '';
}

function contextoEscritura_(body, registro) {
  const nivel = String(body.nivel || '').trim().toLowerCase();
  const bimestre = String(body.bimestre || '').trim().toUpperCase();
  const numero = gradoEscritura_(body.grado);
  const seccion = seccionEscritura_(body.seccion || (nivel === 'primaria' ? 'UNICA' : ''));
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  if ((nivel !== 'primaria' && nivel !== 'secundaria') ||
      !/^(I|II|III|IV)$/.test(bimestre) || !numero ||
      (nivel === 'secundaria' && numero > 5) || !seccion ||
      !area || /[|\u0000-\u001f]/.test(area)) return null;
  // Conservar los formatos que generan Registro y las matrices actuales.
  const nombres = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO'];
  return {
    nivel: nivel, bimestre: bimestre, numero: numero, area: area,
    grado: registro ? String(numero) : (nivel === 'primaria' ? nombres[numero - 1] : numero + '°'),
    seccion: seccion === 'ÚNICA' ? (registro ? 'Única' : (nivel === 'primaria' ? 'UNICA' : 'ÚNICA')) : seccion
  };
}

function aulaEscritura_(value, ctx) {
  const parts = String(value || '').split('|');
  return parts.length === 2 && gradoEscritura_(parts[0]) === ctx.numero &&
    seccionEscritura_(parts[1]) === seccionEscritura_(ctx.seccion);
}

function asignacionesPrimaria_(docente) {
  const out = {}, mapa = docente.asignaciones;
  if (mapa != null && (typeof mapa !== 'object' || Array.isArray(mapa))) return out;
  const grados = Array.isArray(docente.grados) ? docente.grados.map(gradoEscritura_).filter(function(g) { return g >= 1 && g <= 6; }) : [];
  if (mapa && Object.keys(mapa).length) {
    Object.keys(mapa).forEach(function(area) {
      if (!Array.isArray(mapa[area])) return;
      const aulas = mapa[area].filter(function(aula) {
        const parts = String(aula).split('|');
        return parts.length === 2 && grados.indexOf(gradoEscritura_(parts[0])) >= 0 && seccionEscritura_(parts[1]) === 'ÚNICA';
      }).map(function(aula) { return gradoEscritura_(String(aula).split('|')[0]) + '|ÚNICA'; });
      if (aulas.length) out[area] = [...new Set(aulas)];
    });
  } else {
    // Compatibilidad: Admin antiguo guardaba también {}. Nunca concede EF implícita.
    ['Personal Social','Comunicación','Arte y Cultura','Matemática','Ciencia y Tecnología','Educación Religiosa','Competencias Transversales'].forEach(function(area) {
      if (grados.length) out[area] = grados.map(function(g) { return g + '|ÚNICA'; });
    });
  }
  return out;
}

function autorizarEscritura_(body, ctx) {
  const sesion = validarToken_(body.token);
  if (!sesion) return null;
  if (sesion.role === 'admin') {
    return { role: 'admin', user: sesion.user, docente: String(body.docente || '') };
  }
  if (sesion.role !== 'docente') return null;
  if (ctx.nivel === 'secundaria' && ctx.area === 'Competencias Transversales') return null;
  const config = obtenerDocentesConfig_();
  if (Number(sesion.permisosVersion) !== Number(config.ts)) return null;
  const usuario = normalizarUsuario_(sesion.user);
  const docente = config.docentes.find(function (item) {
    return usuario && normalizarUsuario_(item.user) === usuario;
  });
  if (!docente || String(docente.nivel || '').toLowerCase() !== ctx.nivel) return null;
  let permitido = false;
  if (ctx.nivel === 'primaria') {
    const aulas = asignacionesPrimaria_(docente)[ctx.area];
    permitido = Array.isArray(aulas) && aulas.some(function(aula) { return aulaEscritura_(aula, ctx); });
  } else {
    const mapa = docente.asignaciones;
    if (mapa != null && (typeof mapa !== 'object' || Array.isArray(mapa))) return null;
    if (mapa && typeof mapa === 'object' && !Array.isArray(mapa) && Object.keys(mapa).length) {
      const aulas = Object.prototype.hasOwnProperty.call(mapa, ctx.area) ? mapa[ctx.area] : null;
      permitido = Array.isArray(aulas) && aulas.some(function (aula) { return aulaEscritura_(aula, ctx); });
    } else if (Array.isArray(docente.areas) && Array.isArray(docente.aulas)) {
      // Formato anterior: áreas y aulas explícitas. Vacíos no conceden permisos.
      permitido = docente.areas.indexOf(ctx.area) >= 0 &&
        docente.aulas.some(function (aula) { return aulaEscritura_(aula, ctx); });
    }
  }
  return permitido ? { role: 'docente', user: docente.user, docente: docente.nombre || docente.user } : null;
}

function sesionRutaEscritura_(token, roles) {
  const sesion = validarToken_(token);
  return sesion && roles.indexOf(sesion.role) >= 0 ? sesion : null;
}

function itemAsistenciaAutorizado_(item) {
  // La estructura se valida aquí; el permiso por nivel se valida antes de escribir el lote.
  const nivel = String(item.nivel || '').trim().toLowerCase();
  const grado = gradoEscritura_(item.grado);
  const seccion = seccionEscritura_(item.seccion);
  const fecha = typeof item.fecha === 'string' ? item.fecha.trim() : '';
  const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
  if ((nivel !== 'primaria' && nivel !== 'secundaria') || !grado ||
      (nivel === 'secundaria' && grado > 5) || !seccion ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !nombre ||
      /[|\u0000-\u001f]/.test(nombre)) return null;
  return Object.assign({}, item, {
    fecha: fecha, nivel: nivel, grado: String(grado),
    seccion: seccion === 'ÚNICA' ? 'Única' : seccion, nombre: nombre,
    clave: [fecha, nivel, grado, seccion === 'ÚNICA' ? 'Única' : seccion, nombre].join('||')
  });
}

function asegurarConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('ConfigSistema');
  if (!sh) {
    sh = ss.insertSheet('ConfigSistema');
    sh.appendRow(['clave', 'ts', 'json']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function obtenerPeriodosConfig_() {
  const sh = asegurarConfig_();
  const last = sh.getLastRow();
  if (last < 2) return null;
  const data = sh.getRange(2, 1, last - 1, 3).getValues();
  let best = null;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== 'PERIODOS') continue;
    const ts = Number(data[i][1]) || 0;
    if (!best || ts >= best.ts) {
      let periodos = null;
      try {
        const raw = data[i][2];
        if (typeof raw === 'string' && raw) periodos = JSON.parse(raw);
        else if (raw && typeof raw === 'object') periodos = raw;
      } catch (err) { periodos = null; }
      best = { ts: ts, periodos: periodos };
    }
  }
  return best ? best.periodos : null;
}

function bimestreAbierto_(bimestre) {
  const per = obtenerPeriodosConfig_();
  if (!per || !per.bimestres) return false;
  return String(per.bimestres[String(bimestre)] || 'bloqueado').toLowerCase() === 'abierto';
}


function asegurarAip_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('AipPlan');
  if (!sh) {
    sh = ss.insertSheet('AipPlan');
    sh.appendRow(['clave', 'ts', 'json']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function asegurarReg_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('RegistroNotas');
  if (!sh) {
    sh = ss.insertSheet('RegistroNotas');
    sh.appendRow(['clave', 'nivel', 'bimestre', 'grado', 'seccion', 'area', 'docente', 'ts', 'json']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function asegurarTpl_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('SiagiePlantillas');
  if (!sh) {
    sh = ss.insertSheet('SiagiePlantillas');
    sh.appendRow(['clave', 'nivel', 'bimestre', 'grado', 'seccion', 'filename', 'fileId', 'ts']);
    sh.getRange(1, 1, 1, 8).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function carpetaTpl_() {
  const name = 'IE22375_SIAGIE_TPL';
  const it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}
function claveTpl_(nivel, bim, grado, seccion) {
  return [String(nivel||'').toLowerCase(), String(bim||''), String(grado||''), String(seccion||'')].join('||');
}
function asegurarHoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_AREAS);
  if (!sh) {
    sh = ss.insertSheet(HOJA_AREAS);
    sh.appendRow([
      'clave', 'nivel', 'bimestre', 'grado', 'seccion', 'area',
      'docente', 'totalEstudiantes', 'actualizado', 'json'
    ]);
    sh.getRange(1, 1, 1, 10).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sesionLectura_(token, roles) {
  // La validación y la búsqueda del perfil comparten una sola lectura cacheada
  // de DOCENTE_ACCESOS durante esta solicitud.
  const sesion = validarToken_(token, null, false);
  if (!sesion || roles.indexOf(sesion.role) < 0) return null;
  if (sesion.role !== 'docente') return { sesion: sesion };
  const config = obtenerDocentesConfigLectura_();
  if (Number(sesion.permisosVersion) !== Number(config.ts)) return null;
  const user = normalizarUsuario_(sesion.user);
  const docente = config.docentes.find(function (item) {
    return user && normalizarUsuario_(item.user) === user;
  });
  if (!docente) return null;
  const mapa = docente.asignaciones;
  if (mapa != null && (typeof mapa !== 'object' || Array.isArray(mapa))) return null;
  return { sesion: sesion, docente: docente };
}

function puedeLeerContexto_(acceso, ctx) {
  if (acceso.sesion.role === 'admin') return true;
  const docente = acceso.docente;
  if (!docente || String(docente.nivel || '').toLowerCase() !== ctx.nivel ||
      !ctx.numero || !seccionEscritura_(ctx.seccion)) return false;
  if (ctx.nivel === 'primaria') {
    const aulas = asignacionesPrimaria_(docente)[ctx.area];
    return Array.isArray(aulas) && aulas.some(function(aula) { return aulaEscritura_(aula, ctx); });
  }
  if (ctx.nivel !== 'secundaria' || ctx.numero > 5) return false;
  const mapa = docente.asignaciones;
  if (mapa && Object.keys(mapa).length) {
    const aulas = Object.prototype.hasOwnProperty.call(mapa, ctx.area) ? mapa[ctx.area] : null;
    return Array.isArray(aulas) && aulas.some(function (aula) { return aulaEscritura_(aula, ctx); });
  }
  return Array.isArray(docente.areas) && docente.areas.indexOf(ctx.area) >= 0 &&
    Array.isArray(docente.aulas) && docente.aulas.some(function (aula) { return aulaEscritura_(aula, ctx); });
}

function docentesMatrizRuta_(body) {
  const acceso = sesionLectura_(body.token, ['admin', 'docente']);
  if (!acceso) return {ok: false, code: 'SESSION', error: 'Sesión inválida o sin autorización.'};
  const lista = acceso.docente ? [acceso.docente] : obtenerDocentesConfigLectura_().docentes;
  return {ok: true, docentes: lista.map(function(doc) {
    // Lista explícita de campos: nunca propagar pass, usuario u otras credenciales.
    const out = {nombre: String(doc.nombre || ''), nivel: String(doc.nivel || '').toLowerCase(),
      grados: Array.isArray(doc.grados) ? doc.grados.map(gradoEscritura_) : []};
    if (out.nivel === 'primaria') {
      out.asignaciones = asignacionesPrimaria_(doc);
    } else if (doc.asignaciones != null) {
      out.asignaciones = {};
      if (typeof doc.asignaciones === 'object' && !Array.isArray(doc.asignaciones)) {
        Object.keys(doc.asignaciones).forEach(function(area) {
          out.asignaciones[area] = Array.isArray(doc.asignaciones[area]) ? doc.asignaciones[area].map(String) : [];
        });
      }
    } else {
      out.areas = Array.isArray(doc.areas) ? doc.areas.map(String) : [];
      out.aulas = Array.isArray(doc.aulas) ? doc.aulas.map(String) : [];
    }
    return out;
  })};
}

function contextoFilaLectura_(row) {
  return {
    nivel: String(row[1] || '').toLowerCase(), bimestre: String(row[2] || ''),
    numero: gradoEscritura_(row[3]), seccion: String(row[4] || ''), area: String(row[5] || '')
  };
}

function coincideConsultaLectura_(p, ctx) {
  return (!p.nivel || String(p.nivel).toLowerCase() === ctx.nivel) &&
    (!(p.bimestre || p.bim) || String(p.bimestre || p.bim) === ctx.bimestre) &&
    (!p.grado || gradoEscritura_(p.grado) === ctx.numero) &&
    (!p.seccion || seccionEscritura_(p.seccion) === seccionEscritura_(ctx.seccion)) &&
    (!p.area || String(p.area) === ctx.area);
}

function puedeLeerAula_(acceso, ctx) {
  if (acceso.sesion.role === 'admin') return true;
  const docente = acceso.docente;
  const mapa = ctx.nivel === 'primaria' ? asignacionesPrimaria_(docente) : docente.asignaciones;
  const areas = mapa && Object.keys(mapa).length ? Object.keys(mapa) : (docente.areas || []);
  return Array.isArray(areas) && areas.some(function (area) {
    return puedeLeerContexto_(acceso, Object.assign({}, ctx, { area: area }));
  });
}

function payloadRegistroLectura_(payload, acceso, ctx) {
  if (acceso.sesion.role === 'admin') return payload;
  payload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  // Los mapas internos también pueden contener datos de otros contextos (capsSel es global en el cliente).
  function mismoContexto(nivel, bim, grado, seccion, area) {
    return String(nivel).toLowerCase() === ctx.nivel && String(bim) === ctx.bimestre &&
      gradoEscritura_(grado) === ctx.numero && seccionEscritura_(seccion) === seccionEscritura_(ctx.seccion) &&
      (area == null || String(area) === ctx.area);
  }
  function mapaContexto(mapa, conArea, soloAula) {
    const out = {};
    if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return out;
    Object.keys(mapa).forEach(function (key) {
      const parts = key.split('||');
      if ((soloAula ? parts.length === 4 : parts.length > (conArea ? 5 : 4)) && mismoContexto(parts[0], parts[1], parts[2], parts[3], conArea ? parts[4] : null)) out[key] = mapa[key];
    });
    return out;
  }
  return {
    ts: payload.ts,
    sessions: Array.isArray(payload.sessions) ? payload.sessions.filter(function (s) {
      return s && mismoContexto(s.nivel, s.bim, s.grado, s.seccion, s.area);
    }) : [],
    grades: mapaContexto(payload.grades, true), finales: mapaContexto(payload.finales, true),
    concArea: mapaContexto(payload.concArea, true), asistencia: mapaContexto(payload.asistencia, false),
    asisFechas: mapaContexto(payload.asisFechas, false, true), asisFechasEstado: mapaContexto(payload.asisFechasEstado, false),
    capsSel: mapaContexto(payload.capsSel, true), meta: payload.meta || {}
  };
}


// Base privada: versiones inmutables y punteros ACTUAL/OFICIAL en el mismo Spreadsheet.
// El respaldo oficial apunta a la primera importación explícita de Admin, nunca al navegador.
function hojaEstudiantes_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('EstudiantesBase');
  if (!sh) {
    sh = ss.insertSheet('EstudiantesBase');
    sh.appendRow(['clave', 'version', 'json']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leerFilasEstudiantes_(sh) {
  const last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, 3).getValues();
}

function leerVersionEstudiantes_(sh, clave, filas) {
  // Las versiones/punteros se agregan, nunca se modifican: el número de filas
  // evita reutilizar un índice anterior incluso ante escrituras externas.
  const last = sh.getLastRow();
  const indexKey = ESTUDIANTES_CACHE_PREFIX + 'INDEX_' + clave + '_' + last;
  let rows = filas;
  let pointer = null;
  try { pointer = JSON.parse(CacheService.getScriptCache().get(indexKey) || 'null'); } catch (err) {}
  if (!Array.isArray(pointer)) pointer = null;
  if (!pointer) {
    rows = rows || leerFilasEstudiantes_(sh);
    rows.forEach(function(row) { if (String(row[0]) === String(clave)) pointer = row; });
    if (pointer) cachePunteroEstudiantes_(sh, pointer, last);
    else {
      // Ausencia cacheada solo para esta instantánea; seed/import cambia last.
      try { CacheService.getScriptCache().put(indexKey, '[]', ESTUDIANTES_CACHE_TTL_SECONDS); } catch (err) {}
    }
  }
  if (!pointer || !pointer.length) return null;
  const version = String(pointer[1]);
  // La versión forma parte de la clave: un puntero nuevo jamás puede resolver
  // a los datos reconstruidos de una versión anterior.
  const cacheKey = ESTUDIANTES_CACHE_PREFIX + 'CHUNKS_' + version;
  try {
    const cache = CacheService.getScriptCache();
    const meta = JSON.parse(cache.get(cacheKey) || 'null');
    if (meta && meta.version === version && Number.isInteger(meta.chunks) && meta.chunks > 0) {
      let rawCache = '';
      for (let i = 0; i < meta.chunks; i++) {
        const part = cache.get(cacheKey + '_' + i);
        if (part == null) throw new Error('Caché parcial.');
        rawCache += part;
      }
      const estudiantes = JSON.parse(rawCache);
      if (Array.isArray(estudiantes)) return {version: version, partes: meta.partes, estudiantes: estudiantes};
    }
  } catch (err) { /* Reconstruir desde Sheets si la caché no está disponible. */ }
  rows = rows || leerFilasEstudiantes_(sh);
  const manifest = JSON.parse(pointer[2]);
  if (!Number.isInteger(manifest.partes) || manifest.partes < 1) throw new Error('Base privada incompleta.');
  const chunks = {};
  rows.forEach(function(row) { if (String(row[1]) === version) chunks[row[0]] = row[2]; });
  let raw = '';
  for (let i = 0; i < manifest.partes; i++) {
    const chunk = chunks['DATOS_' + version + '_' + i];
    if (typeof chunk !== 'string') throw new Error('Base privada incompleta.');
    raw += chunk;
  }
  const estudiantes = JSON.parse(raw);
  if (!Array.isArray(estudiantes)) throw new Error('Base privada inválida.');
  const result = {version: version, partes: manifest.partes, estudiantes: estudiantes};
  try {
    const cache = CacheService.getScriptCache();
    // 20 000 unidades UTF-16 ocupan como máximo 80 KB UTF-8 (<100 KB/entrada).
    let count = 0;
    for (let i = 0; i < raw.length; i += 20000) cache.put(cacheKey + '_' + count++, raw.slice(i, i + 20000), ESTUDIANTES_CACHE_TTL_SECONDS);
    cache.put(cacheKey, JSON.stringify({version: version, partes: manifest.partes, chunks: count}), ESTUDIANTES_CACHE_TTL_SECONDS);
  } catch (err) { /* Evicción, límite total o fallo: reconstruir desde Sheets. */ }
  return result;
}

function cachePunteroEstudiantes_(sh, pointer, last) {
  try {
    CacheService.getScriptCache().put(ESTUDIANTES_CACHE_PREFIX + 'INDEX_' + pointer[0] + '_' + (last == null ? sh.getLastRow() : last), JSON.stringify(pointer), ESTUDIANTES_CACHE_TTL_SECONDS);
  } catch (err) { /* Sin índice disponible se consulta Sheets. */ }
}

function leerBaseEstudiantes_(sh, oficial, filas) {
  return leerVersionEstudiantes_(sh, oficial ? 'BASE_OFICIAL' : 'BASE_ACTUAL', filas);
}

function normalizarBimestrePadron_(value) {
  const bim = String(value || '').trim().toUpperCase();
  return /^(I|II|III|IV)$/.test(bim) ? bim : '';
}

function leerPadronEstudiantes_(sh, bimestre, filas) {
  const bim = normalizarBimestrePadron_(bimestre);
  return bim ? leerVersionEstudiantes_(sh, 'PADRON_' + bim, filas) : null;
}

function escribirVersionEstudiantes_(sh, estudiantes, claves) {
  const version = Utilities.getUuid();
  const raw = JSON.stringify(estudiantes);
  let partes = 0;
  for (let i = 0; i < raw.length; i += 30000) {
    sh.appendRow(['DATOS_' + version + '_' + partes++, version, raw.slice(i, i + 30000)]);
  }
  const manifest = JSON.stringify({partes: partes});
  (claves || []).forEach(function(clave) {
    sh.appendRow([clave, version, manifest]);
  });
  SpreadsheetApp.flush();
  (claves || []).forEach(function(clave) { cachePunteroEstudiantes_(sh, [clave, version, manifest]); });
  return {version: version, partes: partes, estudiantes: estudiantes};
}

function normalizarBaseEstudiantes_(body) {
  const db = body.base;
  if (!db || !db.primaria || !db.secundaria ||
      !Array.isArray(db.primaria.estudiantes) || !Array.isArray(db.secundaria.estudiantes)) {
    throw new Error('Importa una base con listas de Primaria y Secundaria.');
  }
  const out = [];
  ['primaria', 'secundaria'].forEach(function(nivel) {
    db[nivel].estudiantes.forEach(function(item) {
      if (!item || typeof item !== 'object') throw new Error('Alumno inválido.');
      const grado = gradoEscritura_(item.grado);
      const sec = seccionEscritura_(item.seccion);
      const nombre = String(item.nombre || '').trim();
      const orden = Number(item.orden) || 0;
      const idSiagie = String(item.idSiagie == null ? '' : item.idSiagie).trim();
      const codigoEstudiante = String(item.codigoEstudiante == null ? '' : item.codigoEstudiante).trim();
      const estadoMatricula = String(item.estadoMatricula == null ? '' : item.estadoMatricula).trim().toUpperCase();
      if (!grado || grado > (nivel === 'primaria' ? 6 : 5) || !sec || !nombre ||
          nombre.length > 250 || !Number.isInteger(orden) || orden < 0 ||
          idSiagie.length > 60 || codigoEstudiante.length > 60 || estadoMatricula.length > 40) throw new Error('Alumno inválido.');
      const limpio = {nivel: nivel, grado: grado, seccion: sec === 'ÚNICA' ? 'Única' : sec, orden: orden, nombre: nombre};
      if (idSiagie) limpio.idSiagie = idSiagie;
      if (codigoEstudiante) limpio.codigoEstudiante = codigoEstudiante;
      if (estadoMatricula) limpio.estadoMatricula = estadoMatricula;
      out.push(limpio);
    });
  });
  return out;
}

function respuestaEstudiantes_(base, acceso, meta) {
  const list = base ? base.estudiantes : [];
  const estudiantes = list.filter(function(al) {
    if (acceso.nivelFiltro && al.nivel !== acceso.nivelFiltro) return false;
    if (acceso.sesion.role === 'admin') return true;
    if (acceso.sesion.role === 'auxiliar') return autorizaNivelAuxiliar_(acceso.sesion,al.nivel);
    return puedeLeerAula_(acceso, {nivel: al.nivel, numero: gradoEscritura_(al.grado), seccion: al.seccion});
  }).map(function(al) {
    const out = {nivel: al.nivel, grado: al.grado, seccion: al.seccion, orden: al.orden, nombre: al.nombre};
    if (al.idSiagie) out.idSiagie = String(al.idSiagie);
    if (al.codigoEstudiante) out.codigoEstudiante = String(al.codigoEstudiante);
    if (al.estadoMatricula) out.estadoMatricula = String(al.estadoMatricula);
    return out;
  });
  meta = meta || {};
  return {
    ok: true, estudiantes: estudiantes, version: base ? base.version : '', inicializada: !!base,
    bimestre: meta.bimestre || '',
    padronInicializado: Object.prototype.hasOwnProperty.call(meta, 'padronInicializado') ? !!meta.padronInicializado : !!base,
    fuentePadron: meta.fuentePadron || ''
  };
}

function normalizarNombreIdentidad_(value) {
  return String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function enriquecerListaIdentidades_(estudiantes, body) {
  const nivel = String(body.nivel || '').toLowerCase();
  const grado = gradoEscritura_(body.grado);
  const seccion = seccionEscritura_(body.seccion);
  const identidades = Array.isArray(body.identidades) ? body.identidades : [];
  if ((nivel !== 'primaria' && nivel !== 'secundaria') || !grado || !seccion || !identidades.length || identidades.length > 100) {
    throw new Error('Identidades SIAGIE inválidas.');
  }
  const porNombre = {};
  identidades.forEach(function(it) {
    const nombre = normalizarNombreIdentidad_(it && it.nombre);
    if (!nombre) return;
    const idSiagie = String(it.idSiagie == null ? '' : it.idSiagie).trim();
    const codigoEstudiante = String(it.codigoEstudiante == null ? '' : it.codigoEstudiante).trim();
    if (!idSiagie && !codigoEstudiante) return;
    if (!porNombre[nombre]) porNombre[nombre] = [];
    porNombre[nombre].push({idSiagie: idSiagie, codigoEstudiante: codigoEstudiante});
  });
  let enriquecidos = 0;
  const out = estudiantes.map(function(al) {
    if (al.nivel !== nivel || gradoEscritura_(al.grado) !== grado || seccionEscritura_(al.seccion) !== seccion) return al;
    const hits = porNombre[normalizarNombreIdentidad_(al.nombre)] || [];
    if (hits.length !== 1) return al;
    const hit = hits[0], nuevo = Object.assign({}, al);
    let cambio = false;
    if (hit.idSiagie && String(nuevo.idSiagie || '') !== hit.idSiagie) { nuevo.idSiagie = hit.idSiagie; cambio = true; }
    if (hit.codigoEstudiante && String(nuevo.codigoEstudiante || '') !== hit.codigoEstudiante) { nuevo.codigoEstudiante = hit.codigoEstudiante; cambio = true; }
    if (cambio) enriquecidos++;
    return nuevo;
  });
  return {estudiantes: out, enriquecidos: enriquecidos};
}

function estudiantesRuta_(body) {
  const inicio = Date.now();
  const action = String(body.action).toLowerCase();
  const lectura = action === 'loadstudents';
  const acceso = sesionLectura_(body.token, lectura ? ['admin', 'auxiliar', 'docente'] : ['admin']);
  const authMs = Date.now() - inicio;
  if (!acceso) return {ok: false, code: 'SESSION', error: 'Sesión inválida o sin autorización para estudiantes.'};
  if (lectura && acceso.sesion.role !== 'docente') {
    if (body.nivel && (['primaria','secundaria'].indexOf(body.nivel) < 0 || !autorizaNivelAuxiliar_(acceso.sesion,body.nivel))) return {ok:false,error:'Nivel no autorizado.'};
    acceso.nivelFiltro = body.nivel || '';
  }
  // loadstudents es estrictamente de lectura y no espera el lock global.
  if (lectura) {
    const shLectura = hojaEstudiantes_();
    const bimLectura = normalizarBimestrePadron_(body.bimestre);
    const padronLectura = bimLectura ? leerPadronEstudiantes_(shLectura, bimLectura) : null;
    const baseLectura = padronLectura || leerBaseEstudiantes_(shLectura, false);
    const respuesta = respuestaEstudiantes_(baseLectura, acceso, bimLectura ? {
      bimestre: bimLectura, padronInicializado: !!padronLectura,
      fuentePadron: padronLectura ? 'bimestre' : 'actual'
    } : {padronInicializado: true, fuentePadron: 'actual'});
    // Diagnóstico agregado, sin identidades, credenciales ni tokens.
    const totalMs = Date.now() - inicio;
    respuesta.timing = {authMs: authMs, studentsMs: totalMs - authMs, totalMs: totalMs};
    return respuesta;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = hojaEstudiantes_();
    const actual = leerBaseEstudiantes_(sh, false);

    if (String(body.version == null ? '' : body.version) !== (actual ? actual.version : '')) {
      return {ok: false, code: 'CONFLICT', error: 'La base cambió en otro dispositivo. Recarga antes de guardar.'};
    }

    if (action === 'enrichstudents') {
      if (!actual) throw new Error('Primero importa e inicializa la base oficial privada.');
      const bim = normalizarBimestrePadron_(body.bimestre);
      if (!bim) throw new Error('Selecciona un bimestre válido.');
      const cur = enriquecerListaIdentidades_(actual.estudiantes, body);
      const nuevaActual = cur.enriquecidos ? escribirVersionEstudiantes_(sh, cur.estudiantes, ['BASE_ACTUAL']) : actual;
      const padron = leerPadronEstudiantes_(sh, bim);
      let padronCount = 0;
      if (padron) {
        const enrPadron = enriquecerListaIdentidades_(padron.estudiantes, body);
        padronCount = enrPadron.enriquecidos;
        if (padronCount) escribirVersionEstudiantes_(sh, enrPadron.estudiantes, ['PADRON_' + bim]);
      }
      const resp = respuestaEstudiantes_(nuevaActual, acceso, {bimestre: bim, padronInicializado: !!padron, fuentePadron: 'actual'});
      resp.enriquecidosBase = cur.enriquecidos;
      resp.enriquecidosPadron = padronCount;
      return resp;
    }

    if (action === 'seedstudentsroster') {
      if (!actual) throw new Error('Primero importa e inicializa la base oficial privada.');
      const bim = normalizarBimestrePadron_(body.bimestre);
      if (!bim) throw new Error('Selecciona un bimestre válido.');
      const existente = leerPadronEstudiantes_(sh, bim);
      if (existente) return respuestaEstudiantes_(existente, acceso, {
        bimestre: bim, padronInicializado: true, fuentePadron: 'bimestre'
      });
      sh.appendRow(['PADRON_' + bim, actual.version, JSON.stringify({partes: actual.partes})]);
      SpreadsheetApp.flush();
      cachePunteroEstudiantes_(sh, ['PADRON_' + bim, actual.version, JSON.stringify({partes: actual.partes})]);
      return respuestaEstudiantes_(actual, acceso, {
        bimestre: bim, padronInicializado: true, fuentePadron: 'bimestre'
      });
    }

    if (action === 'syncstudents') {
      if (!actual) throw new Error('Primero importa e inicializa la base oficial privada.');
      const bim = normalizarBimestrePadron_(body.bimestre);
      if (!bim) throw new Error('Selecciona un bimestre válido.');
      if (!bimestreAbierto_(bim)) {
        return {ok: false, code: 'PERIOD_CLOSED', error: 'El bimestre ' + bim + ' no está abierto. Su padrón no se modificará.'};
      }
      const estudiantes = normalizarBaseEstudiantes_(body);
      if (!estudiantes.length) throw new Error('La actualización SIAGIE no puede dejar la base vacía.');
      const nueva = escribirVersionEstudiantes_(sh, estudiantes, ['BASE_ACTUAL', 'PADRON_' + bim]);
      return respuestaEstudiantes_(nueva, acceso, {
        bimestre: bim, padronInicializado: true, fuentePadron: 'bimestre'
      });
    }

    if (action === 'restorestudents') {
      const respaldo = leerBaseEstudiantes_(sh, true);
      if (!respaldo) throw new Error('Todavía no existe un respaldo oficial privado.');
      body.base = {
        primaria: {estudiantes: respaldo.estudiantes.filter(function(a) { return a.nivel === 'primaria'; })},
        secundaria: {estudiantes: respaldo.estudiantes.filter(function(a) { return a.nivel === 'secundaria'; })}
      };
    } else if (action === 'initstudents') {
      if (actual || leerBaseEstudiantes_(sh, true)) throw new Error('La base oficial ya está inicializada.');
    } else if (!actual) {
      throw new Error('Primero importa e inicializa la base oficial privada.');
    }

    const estudiantes = normalizarBaseEstudiantes_(body);
    if (action === 'initstudents' && !estudiantes.length) throw new Error('La base oficial inicial no puede estar vacía.');
    const claves = action === 'initstudents' ? ['BASE_OFICIAL', 'BASE_ACTUAL'] : ['BASE_ACTUAL'];
    const nueva = escribirVersionEstudiantes_(sh, estudiantes, claves);
    return respuestaEstudiantes_(nueva, acceso, {padronInicializado: true, fuentePadron: 'actual'});
  } finally { lock.releaseLock(); }
}

function tutorAulas_(doc) {
  if (String(doc.nivel).toLowerCase() !== 'secundaria' || doc.activo === false || !Array.isArray(doc.tutorAulas)) return [];
  return [...new Set(doc.tutorAulas.map(function(a) {
    const p=String(a).split('|'), g=gradoEscritura_(p[0]), s=seccionEscritura_(p[1]);
    return p.length===2 && g>=1 && g<=5 && s ? g+'|'+s : '';
  }).filter(Boolean))];
}
function validarTutores_(list) {
  const duenos={};
  for (const doc of list) for (const aula of tutorAulas_(doc)) {
    if (duenos[aula]) return false;
    duenos[aula]=true;
  }
  return true;
}
function registroEvaluacion_() {
  function numToLetter(n) { n=Number(n);if(isNaN(n)||n<0||n>20)return '';return n>=18?'AD':n>=14?'A':n>=11?'B':'C'; }
  function letterToNum(L) { return ({AD:19,A:15,B:12,C:8})[L] ?? ''; }
  function promedioNums(arr) { const v=arr.filter(x=>x!==''&&x!=null&&!isNaN(Number(x))).map(Number);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null; }
  function valor(raw) {
    if(!raw||!['letra','num'].includes(raw.modo))return null;
    if(raw.modo==='letra')return ['AD','A','B','C'].includes(raw.valor)?{modo:'letra',valor:raw.valor,nivel:raw.valor}:null;
    if(raw.valor===''||raw.valor==null||(typeof raw.valor!=='number'&&typeof raw.valor!=='string'))return null;
    const entrada=Number(raw.valor);if(!Number.isFinite(entrada)||entrada<0||entrada>20)return null;
    const n=Math.round(entrada);return {modo:'num',valor:n,nota20:n,nivel:numToLetter(n)};
  }
  const COMP={tic:'Se desenvuelve en los entornos virtuales generados por las TIC',autonomia:'Gestiona su aprendizaje de manera autónoma'};
  const CAPS={tic:['Personaliza entornos virtuales','Gestiona información del entorno virtual','Interactúa en entornos virtuales','Crea objetos virtuales en diversos formatos'],autonomia:['Define metas de aprendizaje','Organiza acciones estratégicas para alcanzar sus metas de aprendizaje','Monitorea y ajusta su desempeño durante el proceso de aprendizaje']};
  function sessionKey(s) { return JSON.stringify([s.fecha,s.comp,s.capacidad]); }
  function resultados(evidencia,ids) {
    const valores={},estadisticas={};
    ids.forEach(id=>{valores[id]={};estadisticas[id]={};Object.keys(COMP).forEach(comp=>{
      const nums=[],caps=new Set();let evidencias=0;
      (evidencia.sessions||[]).filter(s=>s.comp===comp).forEach(s=>{
        const g=((evidencia.grades||{})[sessionKey(s)]||{})[id];if(!g)return;
        const n=g.nota20!=null&&g.nota20!==''?Number(g.nota20):letterToNum(g.nivel);
        if(n!==''&&Number.isFinite(n)){nums.push(n);caps.add(s.capacidad);evidencias++;}
      });
      const promedio=promedioNums(nums);
      if(promedio!=null)valores[id][comp]={modo:'num',valor:promedio,nota20:promedio,nivel:numToLetter(promedio)};
      estadisticas[id][comp]={evidencias,capacidades:[...caps],totalCapacidades:CAPS[comp].length};
    });});
    return {valores,estadisticas};
  }
  return {numToLetter,letterToNum,promedioNums,valor,COMP,CAPS,sessionKey,resultados};
}
function transversalValor_(raw) { return registroEvaluacion_().valor(raw); }
function transversalEvidencia_(raw,ctx,acceso,ids,ts,previo) {
  const core=registroEvaluacion_(),obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(!obj(raw)||raw.schema!==1||!Array.isArray(raw.sessions)||!obj(raw.grades))throw new Error('Guarda sesiones y capacidades, no una valoración directa.');
  const sessions=[],grades={},seen=new Set(),anteriores=previo&&previo.evidencia;
  raw.sessions.forEach(s=>{
    if(!obj(s)||!Object.prototype.hasOwnProperty.call(core.CAPS,s.comp)||!core.CAPS[s.comp].includes(s.capacidad))throw new Error('Competencia o capacidad no autorizada.');
    const fecha=String(s.fecha||''),p=fecha.split('-').map(Number),dias=[31,p[0]%4===0&&(p[0]%100!==0||p[0]%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||p[0]<1||p[1]<1||p[1]>12||p[2]<1||p[2]>dias[p[1]-1])throw new Error('Fecha de sesión inválida.');
    const id=core.sessionKey(s);if(seen.has(id))throw new Error('La capacidad ya está en esa sesión/fecha.');seen.add(id);
    const old=anteriores&&(anteriores.sessions||[]).find(x=>core.sessionKey(x)===id);
    sessions.push({id,fecha,comp:s.comp,capacidad:s.capacidad,nivel:'secundaria',bimestre:ctx.bimestre,grado:ctx.numero,seccion:ctx.seccion,area:ctx.area,user:normalizarUsuario_(acceso.sesion.user),docente:old?old.docente:(acceso.docente.nombre||acceso.sesion.user),ts:old?old.ts:ts});
  });
  Object.keys(raw.grades).forEach(key=>{
    if(!seen.has(key)||!obj(raw.grades[key]))throw new Error('Calificación sin sesión/capacidad válida.');grades[key]={};
    Object.keys(raw.grades[key]).forEach(id=>{
      if(!ids.has(id))throw new Error('Estudiante ajeno al padrón del aula.');const v=core.valor(raw.grades[key][id]);if(!v)throw new Error('Calificación inválida.');
      const old=anteriores&&((anteriores.grades||{})[key]||{})[id];grades[key][id]=Object.assign({},v,{ts:old&&old.modo===v.modo&&old.valor===v.valor?old.ts:ts});
    });
  });
  const evidencia={schema:1,sessions,grades};evidencia.finales=core.resultados(evidencia,[...ids]).valores;return evidencia;
}
function transversalIdentidad_(al) {
  return String(al.idSiagie||'').trim() ? 'id:'+encodeURIComponent(String(al.idSiagie).trim()) : String(al.codigoEstudiante||'').trim() ? 'cod:'+encodeURIComponent(String(al.codigoEstudiante).trim()) : 'nom:'+encodeURIComponent(normalizarNombreIdentidad_(String(al.nombre||'').replace(/,/g,' ')));
}
function transversalFilas_(nombre) {
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if(!sh||sh.getLastRow()<2)return [];
  const col=nombre==='TransversalesAportes'?8:6,rows=sh.getRange(2,1,sh.getLastRow()-1,col+1).getValues(),parts=new Map();
  rows.forEach(row=>{const raw=JSON.parse(row[col]);if(raw._ieTransversalParte===1)parts.set(String(row[0]),raw.data);});
  return rows.filter(row=>JSON.parse(row[col])._ieTransversalParte!==1).map(row=>{
    const raw=JSON.parse(row[col]);if(raw._ieTransversalBloque!==1)return row;
    const joined=[];for(let i=0;i<raw.partes;i++){const key=String(row[0])+'||@parte||'+row[col-1]+'||'+i;if(!parts.has(key))throw new Error('Bloque transversal incompleto. No se puede confirmar ni exportar.');joined.push(parts.get(key));}
    const out=row.slice();out[col]=joined.join('');return out;
  });
}
function transversalAppend_(nombre,row) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(nombre);
  if(!sh){sh=ss.insertSheet(nombre);sh.appendRow(nombre==='TransversalesAportes'?['clave','bimestre','grado','seccion','areaOrigen','docente','user','ts','json']:['clave','bimestre','grado','seccion','versionAportes','ts','json']);}
  const col=nombre==='TransversalesAportes'?8:6,raw=String(row[col]);
  if(raw.length<=45000){sh.appendRow(row);return;}
  const n=Math.ceil(raw.length/7000);
  for(let i=0;i<n;i++){const part=row.slice();part[0]=String(row[0])+'||@parte||'+row[col-1]+'||'+i;part[col]=JSON.stringify({_ieTransversalParte:1,data:raw.slice(i*7000,(i+1)*7000)});sh.appendRow(part);}
  // Las partes deben estar visibles antes del marcador final; los fragmentos sin marcador nunca son una versión.
  SpreadsheetApp.flush();const commit=row.slice();commit[col]=JSON.stringify({_ieTransversalBloque:1,partes:n});sh.appendRow(commit);
}
function transversalContexto_(body) {
  const g=gradoEscritura_(body.grado), s=seccionEscritura_(body.seccion), b=String(body.bimestre||'');
  return g>=1 && g<=5 && s && ['I','II','III','IV'].includes(b) && (!body.nivel || body.nivel==='secundaria') ? {nivel:'secundaria',numero:g,grado:g,seccion:s,bimestre:b,area:String(body.area||'')} : null;
}
function transversalTutor_(acceso,ctx) { return acceso.docente && tutorAulas_(acceso.docente).includes(ctx.numero+'|'+ctx.seccion); }
function transversalAcad_(acceso,ctx) { return ctx.area!=='Competencias Transversales' && acceso.sesion.role==='docente' && puedeLeerContexto_(acceso,ctx); }
function transversalDatos_(ctx,config) {
  const sh=hojaEstudiantes_(), padron=leerPadronEstudiantes_(sh,ctx.bimestre)||leerBaseEstudiantes_(sh,false);
  if (!padron) throw new Error('Base privada no inicializada.');
  const estudiantes=padron.estudiantes.filter(a=>a.nivel==='secundaria' && gradoEscritura_(a.grado)===ctx.numero && seccionEscritura_(a.seccion)===ctx.seccion).map(a=>{
    const out={id:transversalIdentidad_(a),nombre:a.nombre,orden:a.orden};if(a.idSiagie)out.idSiagie=a.idSiagie;if(a.codigoEstudiante)out.codigoEstudiante=a.codigoEstudiante;return out;
  });
  if (new Set(estudiantes.map(a=>a.id)).size!==estudiantes.length) throw new Error('Identidad ambigua: revise el padrón antes de evaluar.');
  const clave=['secundaria',ctx.bimestre,ctx.numero,ctx.seccion].join('||'), actuales={}, areas=new Set(),asignaciones=[],tutores=[];
  const aula=ctx.numero+'|'+ctx.seccion;
  config.docentes.forEach(doc=>{
    if (doc.nivel!=='secundaria') return;
    if(tutorAulas_(doc).includes(aula))tutores.push(normalizarUsuario_(doc.user));
    const mapa=doc.asignaciones, lista=mapa && Object.keys(mapa).length?Object.keys(mapa):(doc.areas||[]);
    lista.filter(a=>a!=='Competencias Transversales').forEach(area=>{
      if(puedeLeerContexto_({sesion:{role:'docente'},docente:doc},Object.assign({},ctx,{area}))){areas.add(area);asignaciones.push(JSON.stringify([area,normalizarUsuario_(doc.user),aula]));}
    });
  });
  // Solo relaciones académicas de esta aula: el orden, nombres y contraseñas no son versiones académicas.
  const configAula=JSON.stringify([clave,[...new Set(asignaciones)].sort(),[...new Set(tutores)].sort()]);
  const fingerprint=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,configAula,Utilities.Charset.UTF_8)).replace(/=+$/,'');
  let version=0;
  transversalFilas_('TransversalesAportes').forEach(row=>{
    if (String(row[1])!==ctx.bimestre || gradoEscritura_(row[2])!==ctx.numero || seccionEscritura_(row[3])!==ctx.seccion) return;
    const ts=Number(row[7])||0;version=Math.max(version,ts);
    if (!actuales[row[0]] || ts>actuales[row[0]].ts){const payload=JSON.parse(row[8]);actuales[row[0]]={area:String(row[4]),docente:String(row[5]),user:String(row[6]),ts,version:ts,evidencia:payload.schema===1?payload:null,legacyValores:payload.schema===1?null:payload,valores:{}};}
  });
  const aportes=Object.values(actuales).filter(a=>{
    const doc=config.docentes.find(d=>normalizarUsuario_(d.user)===normalizarUsuario_(a.user));
    return doc && a.area!=='Competencias Transversales' && puedeLeerContexto_({sesion:{role:'docente'},docente:doc},Object.assign({},ctx,{area:a.area}));
  });
  // Identidad vigente por ID/código; nombres solo sin homónimos. No reescribir filas originales.
  const alias={};estudiantes.forEach(al=>{
    const keys=[al.id];if(al.codigoEstudiante)keys.push('cod:'+encodeURIComponent(String(al.codigoEstudiante).trim()));
    if(estudiantes.filter(x=>transversalIdentidad_({nombre:x.nombre})===transversalIdentidad_({nombre:al.nombre})).length===1)keys.push(transversalIdentidad_({nombre:al.nombre}));alias[al.id]=keys;
  });
  aportes.forEach(a=>{
    if(!a.evidencia)return;const grades={};
    Object.keys(a.evidencia.grades||{}).forEach(key=>{grades[key]={};estudiantes.forEach(al=>{const source=a.evidencia.grades[key],id=alias[al.id].find(k=>Object.prototype.hasOwnProperty.call(source,k));if(id)grades[key][al.id]=source[id];});});
    a.evidencia.grades=grades;const result=registroEvaluacion_().resultados(a.evidencia,estudiantes.map(a=>a.id));
    a.valores=result.valores;a.estadisticas=result.estadisticas;a.evidencia.finales=result.valores;
  });
  let consolidado={version:0,finales:{}};
  transversalFilas_('TransversalesConsolidado').forEach(row=>{if(String(row[0])===clave && Number(row[5])>consolidado.version)consolidado={version:Number(row[5]),finales:JSON.parse(row[6])};});
  return {clave,estudiantes,areas:[...areas].sort(),aportes,consolidado,versionTs:version,versionAportes:'evidencias-v1:'+fingerprint+':'+version+':'+padron.version};
}
function transversalResumen_(datos,id,comp) {
  const porArea={};datos.aportes.forEach(a=>{const v=(a.valores[id]||{})[comp];if(v && (!porArea[a.area]||a.ts>porArea[a.area].ts))porArea[a.area]={area:a.area,docente:a.docente,ts:a.ts,valor:v};});
  const aportes=Object.values(porArea),conteo={AD:0,A:0,B:0,C:0};aportes.forEach(a=>conteo[a.valor.nivel]++);
  const max=Math.max(...Object.values(conteo)), ganadores=Object.keys(conteo).filter(k=>conteo[k]===max), sugerencia=max && ganadores.length===1?ganadores[0]:null;
  const orden=['C','B','A','AD'],indices=aportes.map(a=>orden.indexOf(a.valor.nivel)), faltan=datos.areas.filter(a=>!porArea[a]);
  const empate=max>0 && ganadores.length>1, dispersion=indices.length>1 && Math.max(...indices)-Math.min(...indices)>=2;
  return {aportes,conteo,recibidos:aportes.length,sugerencia,empate,dispersion,faltan,alerta:empate||dispersion||faltan.length>0};
}
function transversalConclusionPendiente_(final) { return !!(final && final.nivel==='C' && !String(final.conclusion||'').trim()); }
function transversalListo_(final,version) { return !!(final && final.nivel && !transversalConclusionPendiente_(final) && final.versionAportes===version && final.tutor && final.aip); }
function transversalVista_(datos,acceso,ctx) {
  const coord=['admin','pip'].includes(acceso.sesion.role)||transversalTutor_(acceso,ctx), resultados={};
  if(coord) datos.estudiantes.forEach(al=>{resultados[al.id]={};['tic','autonomia'].forEach(comp=>{
    const final=(datos.consolidado.finales[al.id]||{})[comp]||null, resumen=transversalResumen_(datos,al.id,comp);
    const obsoleto=!!final && final.versionAportes!==datos.versionAportes;
    resultados[al.id][comp]={resumen,final,listo:transversalListo_(final,datos.versionAportes),estado:transversalConclusionPendiente_(final)?'Conclusión descriptiva obligatoria para nivel C':obsoleto?'Requiere nueva confirmación':!final||!final.tutor?'Pendiente de confirmación del Tutor':!final.aip?'Pendiente de confirmación del AIP':'✓ Consolidación confirmada · Lista para SIAGIE'};
  });});
  return {ok:true,estudiantes:datos.estudiantes,areas:datos.areas,versionAportes:datos.versionAportes,version:datos.consolidado.version,
    aportes:coord?datos.aportes:datos.aportes.filter(a=>normalizarUsuario_(a.user)===normalizarUsuario_(acceso.sesion.user)&&a.area===ctx.area),resultados,
    puedeFinal:acceso.sesion.role==='pip'||transversalTutor_(acceso,ctx),puedeTutor:!!transversalTutor_(acceso,ctx),puedeAip:acceso.sesion.role==='pip',abierto:bimestreAbierto_(ctx.bimestre)};
}
function transversalesRuta_(body) {
  const action=String(body.action||'').toLowerCase(), actions=['loadtransversales','loadtransversalesaulas','savetransversalaporte','savetransversalfinal','confirmtransversaltutor','confirmtransversalaip','loadtransversalexport'];
  if(!actions.includes(action))return {ok:false,code:'METHOD',error:'Acción transversal no válida.'};
  const escritura=action.startsWith('save')||action.startsWith('confirm'),lock=escritura?LockService.getScriptLock():null;
  if(lock)lock.waitLock(5000);
  try {
    const acceso=sesionLectura_(body.token,['admin','docente','pip']);
    if(!acceso || (acceso.docente && acceso.docente.nivel!=='secundaria'))return {ok:false,code:'SESSION',error:'Sesión inválida o sin autorización transversal.'};
    const config=obtenerDocentesConfigLectura_();
    if(action==='loadtransversalesaulas') {
      if(acceso.docente&&!tutorAulas_(acceso.docente).length)return {ok:false,code:'DENIED',error:'Solo Tutor, AIP o Admin pueden entrar a consolidar.'};
      const sh=hojaEstudiantes_(),base=leerBaseEstudiantes_(sh,false),aulas=new Set();
      if(base)base.estudiantes.filter(a=>a.nivel==='secundaria').forEach(a=>{const ctx={numero:gradoEscritura_(a.grado),seccion:seccionEscritura_(a.seccion)};if(['admin','pip'].includes(acceso.sesion.role)||transversalTutor_(acceso,ctx))aulas.add(ctx.numero+'|'+ctx.seccion);});
      return {ok:true,aulas:[...aulas].sort(),periodos:obtenerPeriodosConfig_(),puedeTutor:acceso.sesion.role==='docente',puedeAip:acceso.sesion.role==='pip'};
    }
    const ctx=transversalContexto_(body);
    if(!ctx)return {ok:false,code:'CONTEXT',error:'Aula o bimestre inválido.'};
    const coord=['admin','pip'].includes(acceso.sesion.role)||transversalTutor_(acceso,ctx),acad=transversalAcad_(acceso,ctx);
    if((action==='loadtransversales'&&!coord&&!acad)||(action==='loadtransversalexport'&&acceso.sesion.role!=='admin') || (action==='savetransversalaporte'&&!acad) || (action==='savetransversalfinal'&&acceso.sesion.role!=='pip'&&!transversalTutor_(acceso,ctx)) || (action==='confirmtransversaltutor'&&!transversalTutor_(acceso,ctx)) || (action==='confirmtransversalaip'&&acceso.sesion.role!=='pip'))return {ok:false,code:'DENIED',error:'Acción no autorizada para esta aula y área.'};
    if(escritura&&!bimestreAbierto_(ctx.bimestre))return {ok:false,code:'PERIOD',error:'Bimestre cerrado o bloqueado: solo lectura.'};
    const datos=transversalDatos_(ctx,config), ids=new Set(datos.estudiantes.map(a=>a.id));
    if(action==='savetransversalaporte') {
      const key=datos.clave+'||'+ctx.area+'||'+normalizarUsuario_(acceso.sesion.user), previo=datos.aportes.find(a=>a.area===ctx.area&&normalizarUsuario_(a.user)===normalizarUsuario_(acceso.sesion.user));
      if(Number(body.version)!==Number(previo?previo.version:0))return {ok:false,code:'CONFLICT',error:'El aporte cambió en otro dispositivo. Recarga.'};
      const ts=Math.max(Date.now(),datos.versionTs+1),evidencia=transversalEvidencia_(body.evidencia,ctx,acceso,ids,ts,previo);
      transversalAppend_('TransversalesAportes',[key,ctx.bimestre,ctx.numero,ctx.seccion,ctx.area,acceso.docente.nombre||acceso.sesion.user,normalizarUsuario_(acceso.sesion.user),ts,JSON.stringify(evidencia)]);
    } else if(escritura) {
      if(Number(body.version)!==datos.consolidado.version || body.versionAportes!==datos.versionAportes)return {ok:false,code:'CONFLICT',error:'La decisión o los aportes cambiaron. Recarga antes de guardar o confirmar.'};
      const finales=JSON.parse(JSON.stringify(datos.consolidado.finales)),ts=Math.max(Date.now(),datos.consolidado.version+1);
      if(action==='savetransversalfinal') {
        if(!body.finales||typeof body.finales!=='object'||Array.isArray(body.finales))throw new Error('Decisiones inválidas.');
        Object.keys(body.finales).forEach(id=>{
          if(!ids.has(id))throw new Error('Estudiante ajeno al padrón.');finales[id]=finales[id]||{};
          Object.keys(body.finales[id]).forEach(comp=>{
            if(!['tic','autonomia'].includes(comp))throw new Error('Competencia inválida.');
            const raw=body.finales[id][comp],valor=transversalValor_(raw),resumen=transversalResumen_(datos,id,comp),justificacion=String(raw.justificacion||'').trim(),conclusion=String(raw.conclusion||'').trim();
            if(!valor)throw new Error('La calificación final es inválida.');
            if((resumen.alerta||!resumen.sugerencia||valor.nivel!==resumen.sugerencia)&&justificacion.length<5)throw new Error('Se requiere una justificación breve para esta decisión.');
            if(justificacion.length>2000)throw new Error('Justificación demasiado extensa.');
            if(conclusion.length>2000)throw new Error('Conclusión descriptiva demasiado extensa.');
            const previo=finales[id][comp],igual=previo&&previo.modo===valor.modo&&previo.valor===valor.valor&&previo.justificacion===justificacion&&String(previo.conclusion||'')===conclusion&&previo.versionAportes===datos.versionAportes;
            if(!igual)finales[id][comp]=Object.assign({},valor,{justificacion,conclusion,sugerencia:resumen.sugerencia,conteo:resumen.conteo,alerta:resumen.alerta,versionAportes:datos.versionAportes,user:acceso.sesion.user,role:acceso.sesion.role,ts,tutor:null,aip:null});
          });
        });
      } else {
        let n=0;Object.keys(finales).forEach(id=>{if(!ids.has(id))return;['tic','autonomia'].forEach(comp=>{
          const f=finales[id][comp];if(!f)return;
          if(f.versionAportes!==datos.versionAportes)throw new Error('Requiere nueva confirmación: revisa y guarda la decisión con los aportes actuales.');
          if(transversalConclusionPendiente_(f))throw new Error('Conclusión descriptiva obligatoria para nivel C');
          f[action==='confirmtransversaltutor'?'tutor':'aip']={user:acceso.sesion.user,role:acceso.sesion.role,ts};n++;
        });});if(!n)throw new Error('Primero guarda una calificación final.');
      }
      transversalAppend_('TransversalesConsolidado',[datos.clave,ctx.bimestre,ctx.numero,ctx.seccion,datos.versionAportes,ts,JSON.stringify(finales)]);
    }
    return transversalVista_(escritura?transversalDatos_(ctx,config):datos,acceso,ctx);
  } catch(e) { return {ok:false,code:'VALIDATION',error:e.message||'No se pudo completar la operación transversal.'}; }
  finally { if(lock) {try{SpreadsheetApp.flush();}finally{lock.releaseLock();}} }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.bridge === 'login-v1' || p.bridge === 'students-v1' || p.bridge === 'transversales-v1') return loginBridgeVista_(p);
    const action = String(p.action || '').toLowerCase();
    const nivel = String(p.nivel || '').toLowerCase();
    if (action === 'loadstudents') return responder_({ok:false,code:'METHOD_NOT_ALLOWED',error:'La lectura de estudiantes requiere POST con token en el cuerpo.'});
    const rolesLectura = {
      loadreg: ['admin', 'docente'], loadnivel: ['admin', 'docente'], load: ['admin', 'docente'],
      loadtpl: ['admin'], loadtplstatus: ['admin', 'docente'],
      loadasis: ['admin', 'auxiliar'], loadaip: ['admin', 'pip'],
      loadwa: ['admin', 'auxiliar'], classroom: ['admin']
    };
    const roles = Object.prototype.hasOwnProperty.call(rolesLectura, action) ? rolesLectura[action] : null;
    const acceso = roles ? sesionLectura_(p.token, roles) : null;
    if (roles && !acceso) {
      return responder_({ ok: false, error: 'Sesión inválida o sin autorización para esta lectura.' });
    }

    if (action === 'ping') {
      return responder_({ ok: true, msg: 'API Matriz IE 22375 — áreas + asistencia + registro + docentes' });
    }

    if ((action === 'loadasis' || action === 'loadwa') && p.nivel && !autorizaNivelAuxiliar_(acceso.sesion,String(p.nivel))) return responder_({ok:false,error:'Nivel no autorizado.'});

    if (action === 'loadasis') {
      const fecha = String(p.fecha || '');
      const sh = asegurarAsis_();
      const last = sh.getLastRow();
      const items = [];
      if (last >= 2) {
        const data = sh.getRange(2, 1, last, 11).getValues();
        for (let i = 0; i < data.length; i++) {
          if (fecha && String(data[i][1]) !== fecha) continue;
          const nivelItem = String(data[i][2]).toLowerCase();
          if (!autorizaNivelAuxiliar_(acceso.sesion,nivelItem) || (p.nivel && p.nivel !== nivelItem)) continue;
          items.push({
            clave: data[i][0],
            fecha: data[i][1],
            nivel: data[i][2],
            grado: data[i][3],
            seccion: data[i][4],
            nombre: data[i][5],
            marca: data[i][6],
            hora: data[i][7],
            via: data[i][8],
            ts: data[i][9],
            motivo: data[i][10]
          });
        }
      }
      return responder_({ ok: true, fecha: fecha, items: items, total: items.length });
    }

    if (action === 'loadreg') {
      const sh = asegurarReg_();
      const last = sh.getLastRow();
      const items = [];
      if (last >= 2) {
        const data = sh.getRange(2, 1, last, 9).getValues();
        for (let i = 0; i < data.length; i++) {
          const rowNivel = String(data[i][1] || '').toLowerCase();
          if (nivel && rowNivel !== nivel) continue;
          const ctx = contextoFilaLectura_(data[i]);
          if (!puedeLeerContexto_(acceso, ctx) || !coincideConsultaLectura_(p, ctx)) continue;
          let payload = {};
          try {
            const raw = data[i][8];
            if (typeof raw === 'string' && raw) payload = JSON.parse(raw);
            else if (raw && typeof raw === 'object') payload = raw;
          } catch (err) { payload = {}; }
          items.push({
            clave: data[i][0],
            nivel: data[i][1],
            bimestre: data[i][2],
            grado: data[i][3],
            seccion: data[i][4],
            area: data[i][5],
            docente: data[i][6],
            ts: data[i][7],
            payload: payloadRegistroLectura_(payload, acceso, ctx)
          });
        }
      }
      return responder_({ ok: true, nivel: nivel, items: items, total: items.length });
    }

    if (action === 'loadaip') {
      const sh = asegurarAip_();
      const last = sh.getLastRow();
      if (last < 2) return responder_({ ok: true, payload: null, ts: 0 });
      const data = sh.getRange(2, 1, last, 3).getValues();
      let best = null;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) !== 'AIP_PLAN') continue;
        const ts = Number(data[i][1]) || 0;
        if (!best || ts >= best.ts) {
          let payload = null;
          try {
            const raw = data[i][2];
            if (typeof raw === 'string' && raw) payload = JSON.parse(raw);
            else if (raw && typeof raw === 'object') payload = raw;
          } catch (err) { payload = null; }
          best = { ts: ts, payload: payload };
        }
      }
      return responder_({ ok: true, payload: best ? best.payload : null, ts: best ? best.ts : 0 });
    }

    if (action === 'loadtpl' || action === 'loadtplstatus') {
      const bim = String(p.bimestre || p.bim || '');
      const grado = String(p.grado || '');
      const seccion = String(p.seccion || '');
      const sh = asegurarTpl_();
      const last = sh.getLastRow();
      const items = [];
      if (last >= 2) {
        const data = sh.getRange(2, 1, last, 8).getValues();
        for (let i = 0; i < data.length; i++) {
          const rowNivel = String(data[i][1] || '').toLowerCase();
          if (nivel && rowNivel !== nivel) continue;
          if (bim && String(data[i][2]) !== bim) continue;
          if (grado && String(data[i][3]) !== String(grado)) continue;
          if (seccion && String(data[i][4]) !== String(seccion)) continue;
          const ctx = contextoFilaLectura_(data[i]);
          if (!puedeLeerAula_(acceso, ctx)) continue;
          items.push({
            clave: data[i][0],
            nivel: data[i][1],
            bimestre: data[i][2],
            grado: data[i][3],
            seccion: data[i][4],
            filename: data[i][5],
            fileId: acceso.sesion.role === 'admin' ? data[i][6] : '',
            ts: data[i][7]
          });
        }
      }
      if (action === 'loadtplstatus') {
        return responder_({ ok: true, items: items, total: items.length });
      }
      if (!items.length) return responder_({ ok: true, found: false, items: [] });
      const it = items[0];
      let b64 = '';
      try {
        if (it.fileId) b64 = Utilities.base64Encode(DriveApp.getFileById(String(it.fileId)).getBlob().getBytes());
      } catch (err) {
        return responder_({ ok: false, error: 'No se pudo leer el Excel en Drive' });
      }
      return responder_({ ok: true, found: true, filename: it.filename, b64: b64, ts: it.ts });
    }

    if (action === 'loadwa') {
      const sh = asegurarWa_();
      const last = sh.getLastRow();
      if (last < 2) return responder_({ ok: true, grupos: [], ts: 0 });
      const data = sh.getRange(2, 1, last, 3).getValues();
      let best = null;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) !== 'WA_GRUPOS') continue;
        const ts = Number(data[i][1]) || 0;
        if (!best || ts >= best.ts) {
          let grupos = [];
          try {
            const raw = data[i][2];
            if (typeof raw === 'string' && raw) grupos = JSON.parse(raw);
            else if (Array.isArray(raw)) grupos = raw;
          } catch (err) { grupos = []; }
          best = { ts: ts, grupos: grupos };
        }
      }
      return responder_({ ok: true, grupos: (best && Array.isArray(best.grupos) ? best.grupos : []).filter(function(g) { return acceso.sesion.role === 'admin' && !p.nivel || g && autorizaNivelAuxiliar_(acceso.sesion,g.nivel) && (!p.nivel || g.nivel === p.nivel); }), ts: best ? best.ts : 0 });
    }

    if (action === 'loadperiodos') {
      const sh = asegurarConfig_();
      const last = sh.getLastRow();
      if (last < 2) return responder_({ ok: true, periodos: null, ts: 0 });
      const data = sh.getRange(2, 1, last - 1, 3).getValues();
      let best = null;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) !== 'PERIODOS') continue;
        const ts = Number(data[i][1]) || 0;
        if (!best || ts >= best.ts) {
          let periodos = null;
          try {
            const raw = data[i][2];
            if (typeof raw === 'string' && raw) periodos = JSON.parse(raw);
            else if (raw && typeof raw === 'object') periodos = raw;
          } catch (err) { periodos = null; }
          best = { ts: ts, periodos: periodos };
        }
      }
      return responder_({ ok: true, periodos: best ? best.periodos : null, ts: best ? best.ts : 0 });
    }

    if (action === 'loaddoc') {
      return responder_({ ok: false, error: 'loaddoc requiere POST y sesión administrativa.' });
    }

    if (action === 'loadnivel' || action === 'load') {
      if (nivel !== 'primaria' && nivel !== 'secundaria') {
        return responder_({ ok: false, error: 'nivel inválido' });
      }
      const sh = asegurarHoja_();
      const last = sh.getLastRow();
      if (last < 2) {
        return responder_({ ok: true, nivel: nivel, items: [], total: 0 });
      }
      const data = sh.getRange(2, 1, last, 10).getValues();
      const items = [];
      for (let i = 0; i < data.length; i++) {
        const rowNivel = String(data[i][1] || '').toLowerCase();
        if (rowNivel !== nivel) continue;
        const ctx = contextoFilaLectura_(data[i]);
        if (!puedeLeerContexto_(acceso, ctx) || !coincideConsultaLectura_(p, ctx)) continue;
        let competencias = {};
        try {
          const raw = data[i][9];
          if (typeof raw === 'string' && raw) {
            competencias = JSON.parse(raw);
          } else if (raw && typeof raw === 'object') {
            competencias = raw;
          }
        } catch (err) {
          competencias = {};
        }
        items.push({
          clave: data[i][0],
          nivel: data[i][1],
          bimestre: data[i][2],
          grado: data[i][3],
          seccion: data[i][4],
          area: data[i][5],
          docente: data[i][6],
          totalEstudiantes: data[i][7],
          actualizado: data[i][8],
          competencias: competencias
        });
      }
      return responder_({ ok: true, nivel: nivel, items: items, total: items.length });
    }

    if (action === 'classroom') {
      const data = listarClassroom_();
      const cb = String(p.callback || '');
      if (cb && /^[A-Za-z0-9_]+$/.test(cb)) {
        return ContentService
          .createTextOutput(cb + '(' + JSON.stringify(data) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return responder_(data);
    }

    return responder_({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    return responder_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responder_({ ok: false, error: 'Sin datos' });
    }
    const body = JSON.parse(e.postData.contents);
    const action = String(body.action || 'saveArea').toLowerCase();
    if (['loadtransversales','loadtransversalesaulas','savetransversalaporte','savetransversalfinal','confirmtransversaltutor','confirmtransversalaip','loadtransversalexport'].includes(action)) return responder_(transversalesRuta_(body));

    if (['loadreg', 'loadnivel', 'load', 'loadasis', 'loadaip', 'loadtpl', 'loadtplstatus', 'loadwa', 'loadperiodos', 'classroom', 'ping'].indexOf(action) >= 0) {
      return doGet({ parameter: body });
    }

    if (['loadstudents', 'savestudents', 'initstudents', 'restorestudents', 'seedstudentsroster', 'syncstudents', 'enrichstudents'].indexOf(action) >= 0) {
      return responder_(estudiantesRuta_(body));
    }

    if (action === 'login') return responder_(responderLogin_(body));

    if (action === 'loadmatrixteachers') return responder_(docentesMatrizRuta_(body));

    if (action === 'loaddoc') {
      const sesion = validarToken_(body.token, 'admin');
      if (!sesion) return responder_({ ok: false, error: 'Sesión administrativa inválida o vencida.' });
      const config = obtenerDocentesConfig_();
      return responder_({ ok: true, docentes: config.docentes, ts: config.ts, total: config.docentes.length });
    }

    if (action === 'loadauxiliares' || action === 'saveauxiliar') {
      if (!validarToken_(body.token,'admin')) return responder_({ok:false,error:'Sesión administrativa inválida.'});
      return responder_(action === 'loadauxiliares' ? respuestaAuxiliares_(obtenerAuxiliaresConfig_()) : guardarAuxiliar_(body));
    }

    if (action === 'saveasis') {
      const sesion = sesionRutaEscritura_(body.token, ['admin', 'auxiliar']);
      if (!sesion) {
        return responder_({ ok: false, error: 'Sesión inválida o sin autorización para asistencia de ingreso.' });
      }
      const originales = Array.isArray(body.items) ? body.items : [body];
      const items = originales.map(function (item) {
        return item && typeof item === 'object' ? itemAsistenciaAutorizado_(item) : null;
      });
      if ((body.nivel && !autorizaNivelAuxiliar_(sesion,body.nivel)) || items.some(function (item) { return !item || !autorizaNivelAuxiliar_(sesion,item.nivel); })) {
        return responder_({ ok: false, error: 'Contexto de asistencia inválido o nivel no autorizado; no se guardó ningún item.' });
      }
      const sh = asegurarAsis_();
      const last = sh.getLastRow();
      const mapa = {};
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) mapa[String(claves[i][0])] = i + 2;
      }
      let n = 0;
      items.forEach(function (it) {
        const clave = it.clave;
        if (!clave || clave === '||||') return;
        let fila = mapa[clave];
        if (!fila) {
          fila = sh.getLastRow() + 1;
          mapa[clave] = fila;
        }
        sh.getRange(fila, 1).setValue(clave);
        sh.getRange(fila, 2).setValue(it.fecha || '');
        sh.getRange(fila, 3).setValue(it.nivel || '');
        sh.getRange(fila, 4).setValue(it.grado || '');
        sh.getRange(fila, 5).setValue(it.seccion || '');
        sh.getRange(fila, 6).setValue(it.nombre || '');
        sh.getRange(fila, 7).setValue(it.marca || '');
        sh.getRange(fila, 8).setValue(it.hora || '');
        sh.getRange(fila, 9).setValue(it.via || '');
        sh.getRange(fila, 10).setValue(it.ts || Date.now());
        sh.getRange(fila, 11).setValue(it.motivo || '');
        n++;
      });
      return responder_({ ok: true, guardados: n, msg: 'Asistencia guardada' });
    }

    if (action === 'savereg') {
      const ctx = contextoEscritura_(body, true);
      if (!ctx) return responder_({ ok: false, error: 'Contexto de escritura inválido.' });
      const permiso = autorizarEscritura_(body, ctx);
      if (!permiso) return responder_({ ok: false, error: 'Sesión inválida o sin autorización para este registro.' });
      const nivelR = ctx.nivel;
      const bimestre = ctx.bimestre;
      const grado = ctx.grado;
      const seccion = ctx.seccion;
      const area = ctx.area;
      if (!bimestreAbierto_(bimestre)) {
        return responder_({
          ok: false,
          readonly: true,
          error: 'Bimestre ' + bimestre + ' cerrado o bloqueado por Administración. Solo lectura.'
        });
      }
      const clave = [nivelR, bimestre, grado, seccion, area].join('||');
      const sh = asegurarReg_();
      const last = sh.getLastRow();
      let fila = -1;
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) {
          if (String(claves[i][0]) === clave) { fila = i + 2; break; }
        }
      }
      if (fila < 0) fila = sh.getLastRow() + 1;
      sh.getRange(fila, 1).setValue(clave);
      sh.getRange(fila, 2).setValue(nivelR);
      sh.getRange(fila, 3).setValue(bimestre);
      sh.getRange(fila, 4).setValue(grado);
      sh.getRange(fila, 5).setValue(seccion);
      sh.getRange(fila, 6).setValue(area);
      sh.getRange(fila, 7).setValue(permiso.docente);
      sh.getRange(fila, 8).setValue(body.ts || Date.now());
      const payload = Object.assign({}, body.payload || {});
      if (permiso.role === 'docente') {
        const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
          ? payload.meta : {};
        payload.meta = Object.assign({}, meta, { docente: permiso.docente });
      }
      sh.getRange(fila, 9).setValue(JSON.stringify(payload));
      return responder_({ ok: true, clave: clave, fila: fila, msg: 'Registro guardado' });
    }

    if (action === 'saveaip') {
      if (!sesionRutaEscritura_(body.token, ["admin","pip"])) {
        return responder_({ ok: false, error: 'Sesión inválida o sin autorización para esta operación.' });
      }
      const payload = body.payload || body.plan || {};
      const sh = asegurarAip_();
      const last = sh.getLastRow();
      let fila = -1;
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) {
          if (String(claves[i][0]) === 'AIP_PLAN') { fila = i + 2; break; }
        }
      }
      if (fila < 0) fila = sh.getLastRow() + 1;
      const ts = body.ts || Date.now();
      sh.getRange(fila, 1).setValue('AIP_PLAN');
      sh.getRange(fila, 2).setValue(ts);
      sh.getRange(fila, 3).setValue(JSON.stringify(payload));
      return responder_({ ok: true, ts: ts, msg: 'Plan AIP guardado' });
    }

    if (action === 'savetpl') {
      if (!sesionRutaEscritura_(body.token, ["admin"])) {
        return responder_({ ok: false, error: 'Sesión inválida o sin autorización para esta operación.' });
      }
      const nivelT = String(body.nivel || '').toLowerCase();
      const bimestre = String(body.bimestre || '');
      const grado = String(body.grado || '');
      const seccion = String(body.seccion || '');
      const filename = String(body.filename || 'RegNotas.xlsx');
      const b64 = String(body.b64 || '');
      if (!nivelT || !bimestre || !grado || !b64) {
        return responder_({ ok: false, error: 'Faltan nivel, bimestre, grado o archivo' });
      }
      const clave = claveTpl_(nivelT, bimestre, grado, seccion);
      const bytes = Utilities.base64Decode(b64);
      const blob = Utilities.newBlob(bytes, MimeType.MICROSOFT_EXCEL, filename);
      const folder = carpetaTpl_();
      const file = folder.createFile(blob);
      const sh = asegurarTpl_();
      const last = sh.getLastRow();
      let fila = -1;
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) {
          if (String(claves[i][0]) === clave) { fila = i + 2; break; }
        }
      }
      if (fila < 0) fila = sh.getLastRow() + 1;
      else {
        const oldId = String(sh.getRange(fila, 7).getValue() || '');
        if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (err2) {} }
      }
      const ts = body.ts || Date.now();
      sh.getRange(fila, 1).setValue(clave);
      sh.getRange(fila, 2).setValue(nivelT);
      sh.getRange(fila, 3).setValue(bimestre);
      sh.getRange(fila, 4).setValue(grado);
      sh.getRange(fila, 5).setValue(seccion);
      sh.getRange(fila, 6).setValue(filename);
      sh.getRange(fila, 7).setValue(file.getId());
      sh.getRange(fila, 8).setValue(ts);
      return responder_({ ok: true, clave: clave, filename: filename, msg: 'Plantilla SIAGIE habilitada' });
    }

    if (action === 'savewa') {
      if (!sesionRutaEscritura_(body.token, ["admin"])) {
        return responder_({ ok: false, error: 'Sesión inválida o sin autorización para esta operación.' });
      }
      const list = Array.isArray(body.grupos) ? body.grupos : [];
      const sh = asegurarWa_();
      const last = sh.getLastRow();
      let fila = -1;
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) {
          if (String(claves[i][0]) === 'WA_GRUPOS') { fila = i + 2; break; }
        }
      }
      if (fila < 0) fila = sh.getLastRow() + 1;
      const ts = body.ts || Date.now();
      sh.getRange(fila, 1).setValue('WA_GRUPOS');
      sh.getRange(fila, 2).setValue(ts);
      sh.getRange(fila, 3).setValue(JSON.stringify(list));
      return responder_({ ok: true, total: list.length, ts: ts, msg: 'Grupos WhatsApp guardados' });
    }

    if (action === 'saveperiodos') {
      if (!validarToken_(body.token, 'admin')) return responder_({ ok: false, error: 'Sesión administrativa inválida o vencida.' });
      const periodos = body.periodos || {};
      const sh = asegurarConfig_();
      const last = sh.getLastRow();
      let fila = -1;
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last - 1, 1).getValues();
        for (let i = 0; i < claves.length; i++) {
          if (String(claves[i][0]) === 'PERIODOS') { fila = i + 2; break; }
        }
      }
      if (fila < 0) fila = sh.getLastRow() + 1;
      const ts = body.ts || Date.now();
      sh.getRange(fila, 1).setValue('PERIODOS');
      sh.getRange(fila, 2).setValue(ts);
      sh.getRange(fila, 3).setValue(JSON.stringify(periodos));
      return responder_({ ok: true, periodos: periodos, ts: ts, msg: 'Periodos guardados' });
    }

    if (action === 'savedoc') {
      if (!validarToken_(body.token, 'admin')) return responder_({ ok: false, error: 'Sesión administrativa inválida o vencida.' });
      const lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        // Invalidar antes de escribir; si falla, no guardar con una caché obsoleta.
        CacheService.getScriptCache().remove(DOCENTES_CACHE_KEY);
        const list = Array.isArray(body.docentes) ? body.docentes : [];
        if (!validarTutores_(list)) return responder_({ok:false,error:'Solo puede existir un tutor activo por aula.'});
        const sh = asegurarDoc_();
        const last = sh.getLastRow();
        let fila = -1;
        if (last >= 2) {
          const claves = sh.getRange(2, 1, last, 1).getValues();
          for (let i = 0; i < claves.length; i++) {
            if (String(claves[i][0]) === 'DOCENTE_ACCESOS') { fila = i + 2; break; }
          }
        }
        if (fila < 0) fila = sh.getLastRow() + 1;
        const ts = Math.max(Number(body.ts)||Date.now(),Number(obtenerDocentesConfigLectura_().ts||0)+1);
        sh.getRange(fila, 1).setValue('DOCENTE_ACCESOS');
        sh.getRange(fila, 2).setValue(ts);
        sh.getRange(fila, 3).setValue(JSON.stringify(list));
        return responder_({ ok: true, total: list.length, ts: ts, msg: 'Docentes guardados' });
      } finally {
        // Confirmar también escrituras parciales antes de permitir otra lectura.
        try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
      }
    }

    if (action !== 'savearea') {
      return responder_({ ok: false, error: 'Acción no válida' });
    }

    const ctx = contextoEscritura_(body, false);
    if (!ctx) return responder_({ ok: false, error: 'Contexto de escritura inválido.' });
    const permiso = autorizarEscritura_(body, ctx);
    if (!permiso) return responder_({ ok: false, error: 'Sesión inválida o sin autorización para esta área.' });
    const nivel = ctx.nivel;
    const bimestre = ctx.bimestre;
    const grado = ctx.grado;
    const seccion = ctx.seccion;
    const area = ctx.area;
    const docente = permiso.docente;
    const totalEstudiantes = body.totalEstudiantes || '';
    const competencias = body.competencias || {};

    if (!bimestreAbierto_(bimestre)) {
      return responder_({
        ok: false,
        readonly: true,
        error: 'Bimestre ' + bimestre + ' cerrado o bloqueado por Administración. Solo lectura.'
      });
    }

    const clave = [nivel, bimestre, grado, seccion, area].join('|');
    const sh = asegurarHoja_();
    const ahora = new Date();
    const json = JSON.stringify(competencias);

    const last = sh.getLastRow();
    let fila = -1;
    if (last >= 2) {
      const claves = sh.getRange(2, 1, last, 1).getValues();
      for (let i = 0; i < claves.length; i++) {
        if (String(claves[i][0]) === clave) {
          fila = i + 2;
          break;
        }
      }
    }

    if (fila < 0) {
      fila = sh.getLastRow() + 1;
    }

    // Celda por celda: evita el error de dimensiones de setValues
    sh.getRange(fila, 1).setValue(clave);
    sh.getRange(fila, 2).setValue(nivel);
    sh.getRange(fila, 3).setValue(bimestre);
    sh.getRange(fila, 4).setValue(grado);
    sh.getRange(fila, 5).setValue(seccion);
    sh.getRange(fila, 6).setValue(area);
    sh.getRange(fila, 7).setValue(docente);
    sh.getRange(fila, 8).setValue(totalEstudiantes);
    sh.getRange(fila, 9).setValue(ahora);
    sh.getRange(fila, 10).setValue(json);

    return responder_({
      ok: true,
      clave: clave,
      area: area,
      fila: fila,
      actualizado: ahora,
      msg: 'Área guardada (otras áreas intactas)'
    });
  } catch (err) {
    return responder_({ ok: false, error: String(err) });
  }
}

function listarClassroom_() {
  try {
    var res = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 30 });
    var cursos = (res.courses || []).map(function (c) {
      return { id: c.id, name: c.name, section: c.section || '', room: c.room || '' };
    });
    return { ok: true, cursos: cursos, total: cursos.length };
  } catch (err) {
    return { ok: false, error: 'Classroom no está habilitado o esta cuenta no es docente. ' + err };
  }
}
