const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../apps-script/Codigo.js'), 'utf8');

function setup() {
  // Synthetic accounts only; these fixtures never contain production credentials or data.
  const docentes = [
    {user: 'test-primary', nombre: 'Test Primary', nivel: 'primaria', grados: [1, 3], areas: [], aulas: [], asignaciones: {}},
    {user: 'test-secondary', nombre: 'Test Secondary', nivel: 'secundaria', grados: [], areas: ['Matemática', 'Ciencia y Tecnología'], aulas: ['1|A', '1|B', '5|ÚNICA'], asignaciones: {'Matemática': ['1|A', '1|B'], 'Ciencia y Tecnología': ['5|ÚNICA']}},
    {user: 'test-legacy', nombre: 'Test Legacy', nivel: 'secundaria', areas: ['Matemática'], aulas: ['2|B']},
    {user: 'test-empty', nivel: 'secundaria', areas: [], aulas: []}
  ];
  const state = {writes: 0, held: false, files: 0};
  const tables = new Map();
  const cacheEntries = new Map();
  function sheet(name, rows) {
    const sh = {
      rows,
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
      appendRow(row) {state.writes++; rows.push([...row]);},
      setFrozenRows() {},
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValue: () => rows[r - 1]?.[c - 1] ?? '',
          getValues: () => Array.from({length: nr}, (_, i) => Array.from({length: nc}, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
          setValue(value) {state.writes++; rows[r - 1] ||= []; rows[r - 1][c - 1] = value; return this;},
          setFontWeight() {return this;}
        };
      }
    };
    tables.set(name, sh);
    return sh;
  }
  sheet('DocentesAcceso', [['clave', 'ts', 'json'], ['DOCENTE_ACCESOS', 1000, JSON.stringify(docentes)]]);
  sheet('ConfigSistema', [['clave', 'ts', 'json'], ['PERIODOS', 1000, JSON.stringify({bimestres: {I: 'abierto', II: 'cerrado', III: 'bloqueado'}})]]);
  sheet('RegistroNotas', [['clave', 'nivel', 'bimestre', 'grado', 'seccion', 'area', 'docente', 'ts', 'json']]);
  sheet('EstadosAreas', [['clave', 'nivel', 'bimestre', 'grado', 'seccion', 'area', 'docente', 'totalEstudiantes', 'actualizado', 'json']]);
  const props = {IE22375_TOKEN_SECRET: 'synthetic-test-secret', IE22375_ADMIN_PASS: 'synthetic-admin-password', IE22375_AUXILIAR_PASS: 'synthetic-aux-password', IE22375_PIP_PASS: 'synthetic-pip-password'};
  const c = vm.createContext({
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: name => tables.get(name), insertSheet: name => sheet(name, [])}), flush() {}},
    CacheService: {getScriptCache: () => ({get: key => cacheEntries.get(key) || null, put: (key, value, ttl) => {assert.equal(state.held, true); assert.equal(ttl, 21600); cacheEntries.set(key, value);}, remove: key => {assert.equal(state.held, true); cacheEntries.delete(key);}})},
    LockService: {getScriptLock: () => ({waitLock() {assert.equal(state.held, false); state.held = true;}, releaseLock() {assert.equal(state.held, true); state.held = false;}})},
    PropertiesService: {getScriptProperties: () => ({getProperty: key => props[key], setProperty: (key, value) => props[key] = value})},
    Utilities: {
      Charset: {UTF_8: 'utf8'},
      newBlob: value => ({getBytes: () => [...Buffer.from(value)], getDataAsString: () => Buffer.from(value).toString('utf8')}),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64Decode: value => [...Buffer.from(value, 'base64')],
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      computeHmacSha256Signature: (value, secret) => [...crypto.createHmac('sha256', secret).update(value).digest()]
    },
    DriveApp: {
      getFoldersByName: () => ({hasNext: () => true, next: () => ({createFile() {state.files++; return {getId: () => 'synthetic-file-id'};}})}),
      getFileById: () => ({setTrashed() {state.files++;}})
    },
    MimeType: {MICROSOFT_EXCEL: 'test-excel'},
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: text => ({setMimeType: () => ({text})})}
  });
  new vm.Script(source).runInContext(c);
  tables.get('ConfigSistema').rows.push(['AUXILIAR_ACCESOS',1000,JSON.stringify([{user:'auxiliar',nombre:'Synthetic Auxiliary',niveles:['primaria','secundaria'],activo:true,passHash:c.hashAuxiliarPass_('auxiliar','synthetic-aux-password')}])]);
  const post = body => JSON.parse(c.doPost({postData: {contents: JSON.stringify(body)}}).text);
  const token = (user, role = 'docente', extra = {}) => c.firmarToken_({user, role, permisosVersion: 1000, exp: Date.now() + 60000, ...extra});
  const primary = token('test-primary');
  const secondary = token('test-secondary');
  const admin = token('admin', 'admin');
  const body = (action, extra = {}) => ({action, nivel: 'primaria', bimestre: 'I', grado: 1, seccion: 'Única', area: 'Comunicación', payload: {meta: {docente: 'Forged Name', observacion: 'Preserved field'}}, competencias: {test: 1}, docentes, periodos: {bimestres: {I: 'abierto'}}, ...extra});
  return {c, post, token, primary, secondary, admin, body, state, tables, docentes, props};
}

function request(s, action, token, extra = {}) {
  return {
    action, token, nivel: 'primaria', bimestre: 'I', grado: 1, seccion: 'Única',
    b64: Buffer.from('synthetic-file').toString('base64'), filename: 'Test.xlsx',
    payload: {plan: 'synthetic-plan'}, grupos: [],
    items: [{fecha: '2026-10-03', nivel: 'primaria', grado: 1, seccion: 'Única', nombre: 'Synthetic Student', marca: 'P'}],
    ...extra
  };
}
const allowed = {
  saveasis: ['admin', 'auxiliar'], saveaip: ['admin', 'pip'],
  savetpl: ['admin'], savewa: ['admin']
};
for (const [action, roles] of Object.entries(allowed)) {
  for (const role of ['admin', 'auxiliar', 'pip', 'docente']) {
    test(action + ': ' + role + (roles.includes(role) ? ' allowed' : ' denied'), () => {
      const s = setup();
      const token = role === 'docente' ? s.secondary : s.token(role, role);
      const result = s.post(request(s, action, token));
      assert.equal(result.ok, roles.includes(role));
      if (!roles.includes(role)) {
        assert.equal(s.state.writes, 0); assert.equal(s.state.files, 0);
      }
    });
  }
  for (const mode of ['no-token', 'expired', 'altered', 'forged-identity']) {
    test(action + ': rejects ' + mode + ' without side effects', () => {
      const s = setup();
      const rightful = roles[0];
      const token = mode === 'no-token' || mode === 'forged-identity' ? '' : mode === 'expired' ? s.token(rightful, rightful, {exp: Date.now() - 1}) : s.token(rightful, rightful) + 'x';
      const result = s.post(request(s, action, token, {role: 'admin', user: 'admin', docente: 'admin', permisos: ['all']}));
      assert.equal(result.ok, false);
      assert.equal(s.state.writes, 0); assert.equal(s.state.files, 0);
    });
  }
}

test('saveasis: forged key cannot replace a different attendance record', () => {
  const s = setup();
  const token = s.token('auxiliar', 'auxiliar');
  assert.equal(s.post(request(s, 'saveasis', token)).ok, true);
  const key = s.tables.get('AsistenciaIngreso').rows[1][0];
  const result = s.post(request(s, 'saveasis', token, {items: [{fecha: '2026-10-03', nivel: 'secundaria', grado: 2, seccion: 'B', nombre: 'Another Synthetic Student', marca: 'F', clave: key}]}));
  assert.equal(result.ok, true);
  assert.equal(s.tables.get('AsistenciaIngreso').rows[1][6], 'P');
  assert.notEqual(s.tables.get('AsistenciaIngreso').rows[2][0], key);
});
test('saveasis: invalid context rejects the entire batch before writing', () => {
  const s = setup();
  const body = request(s, 'saveasis', s.admin);
  for (const bad of [{nivel: 'other'}, {grado: 99}, {seccion: 'A|B'}, {nombre: 'Injected||Key'}, {fecha: 'bad'}]) {
    assert.equal(s.post({...body, items: [body.items[0], {...body.items[0], ...bad}]}).ok, false);
    assert.equal(s.state.writes, 0);
  }
});
test('saveasis: body role/user cannot expand a PIP or teacher session to attendance', () => {
  const s = setup();
  for (const token of [s.primary, s.token('pip', 'pip')]) {
    assert.equal(s.post(request(s, 'saveasis', token, {role: 'auxiliar', user: 'auxiliar'})).ok, false);
  }
  assert.equal(s.state.writes, 0);
});

test('admin/auxiliar/pip login fast path does not load DOCENTE_ACCESOS', () => {
  for (const [role, property] of [
    ['admin', 'IE22375_ADMIN_PASS'],
    ['auxiliar', 'IE22375_AUXILIAR_PASS'],
    ['pip', 'IE22375_PIP_PASS']
  ]) {
    const s = setup();
    s.c.obtenerDocentesConfig_ = () => { throw new Error('DOCENTE_ACCESOS should not be read'); };
    const profile = s.post({action: 'login', tipo: role, usuario: role, password: s.props[property]});
    assert.equal(profile.ok, true);
    assert.equal(profile.role, role);
    assert.equal(profile.permisosVersion, role === 'auxiliar' ? 1000 : 0);
    assert.ok(s.c.validarToken_(profile.token, role));
  }
});

for (const [role, property] of [['auxiliar', 'IE22375_AUXILIAR_PASS'], ['pip', 'IE22375_PIP_PASS']]) {
  test(role + ': login issues HMAC token with existing role/modules, no local fallback', () => {
    const s = setup();
    const body = {action: 'login', tipo: role, usuario: role, password: s.props[property]};
    const profile = s.post(body);
    assert.equal(profile.ok, true); assert.equal(profile.user, role); assert.equal(profile.role, role);
    assert.deepEqual(profile.mods, role === 'pip' ? ['aip'] : ['auxiliar', 'wa_grupos']);
    assert.ok(s.c.validarToken_(profile.token, role));
    assert.equal(s.post({...body, usuario: 'admin'}).ok, false);
    assert.equal(s.post({...body, password: 'incorrect'}).ok, false);
    delete s.props[property];
    assert.equal(s.post(body).ok, role === 'auxiliar'); // Scoped hashes no longer depend on the old global password.
  });
}

function clientSource(file) {return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');}
function clientFunction(file, name) {
  const html = clientSource(file);
  const m = new RegExp('^( *)(?:async )?function ' + name + '\\([^)]*\\)\\s*\\{', 'm').exec(html);
  assert.ok(m, name);
  const end = html.indexOf('\n' + m[1] + '}', m.index);
  assert.ok(end > m.index);
  return html.slice(m.index, end + m[1].length + 2);
}
for (const file of ['index.html', 'admin.html', 'auxiliar.html', 'aula_innovacion.html']) {
  test(file + ': modified inline JavaScript parses', () => {
    for (const m of clientSource(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
  });
}
for (const [file, name, helper, role, action] of [
  ['admin.html', 'subirPlantillaSiagie', 'tokenSesionAdmin', 'admin', 'savetpl'],
  ['admin.html', 'subirPlantillaAula', 'tokenSesionAdmin', 'admin', 'savetpl'],
  ['admin.html', 'guardarGruposWa', 'tokenSesionAdmin', 'admin', 'savewa'],
  ['auxiliar.html', 'subirUnoNube', 'tokenSesionAuxiliar', 'auxiliar', 'saveasis'],
  ['auxiliar.html', 'subirTodoNube', 'tokenSesionAuxiliar', 'auxiliar', 'saveasis'],
  ['aula_innovacion.html', 'subirAipNube', 'tokenSesionAip', 'pip', 'saveaip']
]) {
  test(file + ': ' + name + ' sends token and backend accepts existing payload', async () => {
    const s = setup(); const token = s.token(role, role); const requests = []; const responses = [];
    const storage = {getItem: () => JSON.stringify({token}), setItem() {}};
    const fileFixture = {name: 'Synthetic.xlsx', arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer};
    const context = vm.createContext({
      sessionStorage: storage, localStorage: storage, window: {}, KEY: 'test', plan: {},
      IEAuxPermissions:{permite:()=>true,niveles:()=>['primaria','secundaria']},
      CLOUD_API_URL: 'test-url',
      fetch: async (url, options) => {
        const body = JSON.parse(options.body); requests.push(body); const response = s.post(body); responses.push(response);
        return {text: async () => JSON.stringify(response), json: async () => response};
      },
      document: {getElementById: id => ({value: /Nivel/.test(id) ? 'primaria' : /Bim/.test(id) ? 'I' : /Sec/.test(id) ? 'Única' : '1', files: [fileFixture]})},
      btoa: value => Buffer.from(value, 'binary').toString('base64'),
      listarPlantillasSiagie() {}, renderAulasSiagie() {}, aulasDelNivel: () => [], loadGruposWa: () => [], saveGruposWaLocal() {},
      guardarCfg() {}, saveHS() {}, paqueteAip: () => ({plan: 'synthetic'}), alert() {}, toast() {}, renderLista() {},
      completarFaltasAlSubir: () => 0, loadAsis: () => ({key: {marca: 'P'}}), asisKey: () => 'key',
      recToItem: () => request(s, 'saveasis', token).items[0]
    });
    new vm.Script(clientFunction(file, helper)).runInContext(context);
    new vm.Script(clientFunction(file, name)).runInContext(context);
    await context[name](1, 'Única', 'test-file');
    assert.equal(requests.length, 1); assert.equal(requests[0].token, token); assert.equal(requests[0].action, action);
    assert.equal(responses[0].ok, true);
  });
}
for (const [role, property] of [['auxiliar', 'IE22375_AUXILIAR_PASS'], ['pip', 'IE22375_PIP_PASS']]) {
  test('index: ' + role + ' login uses backend token and rejects old/expired sessions', async () => {
    const s = setup(); const stored = new Map(); const requests = [];
    const storage = {getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key)};
    const elements = {
      inpTipo: {value: role}, inpDocUser: {value: 'admin'}, inpPass: {value: s.props[property]}, inpRecordar: {checked: false},
      loginErr: {classList: {add() {}, remove() {}}}, btnLogin: {}
    };
    const context = vm.createContext({
      document: {getElementById: id => elements[id]}, sessionStorage: storage,
      localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
      setTimeout, clearTimeout, AbortController, performance, console,
      fetch: async (url, options) => {const body = JSON.parse(options.body); requests.push(body); return {ok: true, text: async () => JSON.stringify(s.post(body))};}
    });
    const script = [...clientSource('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    new vm.Script(script).runInContext(context);
    context.mostrarHub = () => {};
    elements.inpDocUser.value = role;
    await context.intentarLogin();
    assert.equal(requests.length, 1); assert.equal(requests[0].usuario, role); assert.equal(requests[0].tipo, role);
    const profile = context.getSession();
    assert.equal(profile.role, role); assert.ok(s.c.validarToken_(profile.token, role));
    for (const session of [{role, ts: Date.now()}, {...profile, tokenExp: Date.now() - 1}]) {
      storage.setItem('ie22375_session_v1', JSON.stringify(session));
      assert.equal(context.getSession(), null);
    }
  });
}
