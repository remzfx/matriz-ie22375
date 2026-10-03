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
const DOCENTES_CACHE_KEY = 'IE22375_DOCENTE_ACCESOS_V1';
const DOCENTES_CACHE_TTL_SECONDS = 600;

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

function obtenerDocentesConfig_() {
  // El mismo bloqueo protege la lectura/caché y savedoc: evita repoblar datos antiguos.
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    let cache = null;
    try {
      cache = CacheService.getScriptCache();
      const raw = cache.get(DOCENTES_CACHE_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        if (config && Array.isArray(config.docentes) &&
            typeof config.ts === 'number' && isFinite(config.ts)) return config;
      }
    } catch (err) { /* Caché no disponible o inválida: consultar Sheets. */ }
    const config = leerDocentesConfigSheets_();
    if (cache) {
      try {
        cache.put(DOCENTES_CACHE_KEY, JSON.stringify(config), DOCENTES_CACHE_TTL_SECONDS);
      } catch (err) { /* Si excede el límite de caché, Sheets sigue siendo la fuente. */ }
    }
    return config;
  } finally {
    lock.releaseLock();
  }
}

function leerDocentesConfigSheets_() {
  const sh = asegurarDoc_();
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

function validarToken_(token, role) {
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
  if (claims.role === 'docente') {
    const config = obtenerDocentesConfig_();
    if (Number(claims.permisosVersion) !== Number(config.ts)) return null;
  }
  return claims;
}

function responderLogin_(body) {
  const tipo = String(body.tipo || '').toLowerCase();
  const usuario = normalizarUsuario_(body.usuario);
  const pass = String(body.password == null ? '' : body.password).trim();
  if (!pass || (tipo !== 'docente' && tipo !== 'admin')) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }

  const config = obtenerDocentesConfig_();
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
  } else {
    const docente = config.docentes.find(function (item) {
      return normalizarUsuario_(item.user) === usuario &&
        compararSeguro_(String(item.pass == null ? '' : item.pass).trim(), pass);
    });
    if (docente) {
      const nivel = String(docente.nivel || '').toLowerCase();
      perfil = {
        user: docente.user,
        label: docente.nombre || docente.user,
        role: 'docente',
        nivel: nivel,
        grados: nivel === 'primaria' ? (docente.grados || []) : null,
        areas: nivel === 'secundaria' ? (docente.areas || []) : null,
        aulas: nivel === 'secundaria' ? (docente.aulas || []) : null,
        asignaciones: nivel === 'secundaria' ? (docente.asignaciones || null) : null,
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
    permisosVersion: config.ts,
    iat: now,
    exp: exp
  });
  perfil.ok = true;
  perfil.token = token;
  perfil.tokenExp = exp;
  perfil.permisosVersion = config.ts;
  return perfil;
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

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '').toLowerCase();
    const nivel = String(p.nivel || '').toLowerCase();

    if (action === 'ping') {
      return responder_({ ok: true, msg: 'API Matriz IE 22375 — áreas + asistencia + registro + docentes' });
    }

    if (action === 'loadasis') {
      const fecha = String(p.fecha || '');
      const sh = asegurarAsis_();
      const last = sh.getLastRow();
      const items = [];
      if (last >= 2) {
        const data = sh.getRange(2, 1, last, 11).getValues();
        for (let i = 0; i < data.length; i++) {
          if (fecha && String(data[i][1]) !== fecha) continue;
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
            payload: payload
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
          items.push({
            clave: data[i][0],
            nivel: data[i][1],
            bimestre: data[i][2],
            grado: data[i][3],
            seccion: data[i][4],
            filename: data[i][5],
            fileId: data[i][6],
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
      return responder_({ ok: true, grupos: best ? best.grupos : [], ts: best ? best.ts : 0 });
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

    if (action === 'classroom' || action === 'creartarea') {
      const data = action === 'creartarea'
        ? crearTareaClassroom_(p)
        : listarClassroom_();
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

    if (action === 'login') return responder_(responderLogin_(body));

    if (action === 'loaddoc') {
      const sesion = validarToken_(body.token, 'admin');
      if (!sesion) return responder_({ ok: false, error: 'Sesión administrativa inválida o vencida.' });
      const config = obtenerDocentesConfig_();
      return responder_({ ok: true, docentes: config.docentes, ts: config.ts, total: config.docentes.length });
    }

    if (action === 'saveasis') {
      const items = Array.isArray(body.items) ? body.items : [body];
      const sh = asegurarAsis_();
      const last = sh.getLastRow();
      const mapa = {};
      if (last >= 2) {
        const claves = sh.getRange(2, 1, last, 1).getValues();
        for (let i = 0; i < claves.length; i++) mapa[String(claves[i][0])] = i + 2;
      }
      let n = 0;
      items.forEach(function (it) {
        const clave = String(it.clave || [it.fecha, it.nivel, it.grado, it.seccion, it.nombre].join('||'));
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
      const nivelR = String(body.nivel || '').toLowerCase();
      const bimestre = String(body.bimestre || '');
      const grado = String(body.grado || '');
      const seccion = String(body.seccion || '');
      const area = String(body.area || '');
      if (!nivelR || !bimestre || !grado || !area) {
        return responder_({ ok: false, error: 'Faltan nivel, bimestre, grado o área' });
      }
      if (!bimestreAbierto_(bimestre)) {
        return responder_({
          ok: false,
          readonly: true,
          error: 'Bimestre ' + bimestre + ' cerrado o bloqueado por Administración. Solo lectura.'
        });
      }
      const clave = String(body.clave || [nivelR, bimestre, grado, seccion, area].join('||'));
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
      sh.getRange(fila, 7).setValue(body.docente || '');
      sh.getRange(fila, 8).setValue(body.ts || Date.now());
      sh.getRange(fila, 9).setValue(JSON.stringify(body.payload || {}));
      return responder_({ ok: true, clave: clave, fila: fila, msg: 'Registro guardado' });
    }

    if (action === 'saveaip') {
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
      const lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        // Invalidar antes de escribir; si falla, no guardar con una caché obsoleta.
        CacheService.getScriptCache().remove(DOCENTES_CACHE_KEY);
        const list = Array.isArray(body.docentes) ? body.docentes : [];
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
        const ts = body.ts || Date.now();
        sh.getRange(fila, 1).setValue('DOCENTE_ACCESOS');
        sh.getRange(fila, 2).setValue(ts);
        sh.getRange(fila, 3).setValue(JSON.stringify(list));
        return responder_({ ok: true, total: list.length, ts: ts, msg: 'Docentes guardados' });
      } finally {
        // Confirmar también escrituras parciales antes de permitir otra lectura.
        try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
      }
    }

    if (action === 'classroomtarea') {
      return responder_(crearTareaClassroom_(body));
    }

    if (action !== 'savearea') {
      return responder_({ ok: false, error: 'Acción no válida' });
    }

    const nivel = String(body.nivel || '').toLowerCase();
    const bimestre = String(body.bimestre || '');
    const grado = String(body.grado || '');
    const seccion = String(body.seccion || 'UNICA');
    const area = String(body.area || '');
    const docente = String(body.docente || '');
    const totalEstudiantes = body.totalEstudiantes || '';
    const competencias = body.competencias || {};

    if (nivel !== 'primaria' && nivel !== 'secundaria') {
      return responder_({ ok: false, error: 'nivel inválido' });
    }
    if (!bimestre || !grado || !area) {
      return responder_({ ok: false, error: 'Faltan bimestre, grado o área' });
    }
    if (!bimestreAbierto_(bimestre)) {
      return responder_({
        ok: false,
        readonly: true,
        error: 'Bimestre ' + bimestre + ' cerrado o bloqueado por Administración. Solo lectura.'
      });
    }

    const clave = String(body.clave || [nivel, bimestre, grado, seccion, area].join('|'));
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

function crearTareaClassroom_(body) {
  try {
    var courseId = String(body.courseId || '');
    if (!courseId) return { ok: false, error: 'Falta el curso' };
    var trabajo = Classroom.Courses.CourseWork.create({
      title: String(body.titulo || 'Sesión IE 22375'),
      description: String(body.descripcion || ''),
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED',
      materials: body.link ? [{ link: { url: String(body.link), title: 'Registro auxiliar' } }] : []
    }, courseId);
    return { ok: true, id: trabajo.id, alternateLink: trabajo.alternateLink || '', msg: 'Tarea creada en Classroom' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
