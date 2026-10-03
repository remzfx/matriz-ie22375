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
  const state = {writes: 0, held: false};
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
  const props = {IE22375_TOKEN_SECRET: 'synthetic-test-secret'};
  const c = vm.createContext({
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: name => tables.get(name), insertSheet: name => sheet(name, [])}), flush() {}},
    CacheService: {getScriptCache: () => ({get: key => cacheEntries.get(key) || null, put: (key, value, ttl) => {assert.equal(state.held, true); assert.equal(ttl, 600); cacheEntries.set(key, value);}, remove: key => {assert.equal(state.held, true); cacheEntries.delete(key);}})},
    LockService: {getScriptLock: () => ({waitLock() {assert.equal(state.held, false); state.held = true;}, releaseLock() {assert.equal(state.held, true); state.held = false;}})},
    PropertiesService: {getScriptProperties: () => ({getProperty: key => props[key], setProperty: (key, value) => props[key] = value})},
    Utilities: {
      Charset: {UTF_8: 'utf8'},
      newBlob: value => ({getBytes: () => [...Buffer.from(value)], getDataAsString: () => Buffer.from(value).toString('utf8')}),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      computeHmacSha256Signature: (value, secret) => [...crypto.createHmac('sha256', secret).update(value).digest()]
    },
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: text => ({setMimeType: () => ({text})})}
  });
  new vm.Script(source).runInContext(c);
  const post = body => JSON.parse(c.doPost({postData: {contents: JSON.stringify(body)}}).text);
  const token = (user, role = 'docente', extra = {}) => c.firmarToken_({user, role, permisosVersion: 1000, exp: Date.now() + 60000, ...extra});
  const primary = token('test-primary');
  const secondary = token('test-secondary');
  const admin = token('admin', 'admin');
  const body = (action, extra = {}) => ({action, nivel: 'primaria', bimestre: 'I', grado: 1, seccion: 'Única', area: 'Comunicación', payload: {meta: {docente: 'Forged Name', observacion: 'Preserved field'}}, competencias: {test: 1}, docentes, periodos: {bimestres: {I: 'abierto'}}, ...extra});
  return {c, post, token, primary, secondary, admin, body, state, tables, docentes};
}

for (const action of ['savedoc', 'saveperiodos', 'savereg', 'saveArea']) {
  test(action + ': no token is rejected without writes or sensitive response', () => {
    const s = setup();
    const response = s.post(s.body(action));
    assert.equal(response.ok, false); assert.equal(s.state.writes, 0);
    assert.deepEqual(Object.keys(response).sort(), ['error', 'ok']);
  });
  test(action + ': admin accepted', () => {
    const s = setup();
    assert.equal(s.post(s.body(action, {token: s.admin})).ok, true);
    assert.ok(s.state.writes > 0);
  });
  for (const invalid of ['tampered', 'expired', 'wrong-role']) {
    test(action + ': rejects ' + invalid + ' token', () => {
      const s = setup();
      const token = invalid === 'tampered' ? s.admin + 'x' : invalid === 'expired' ? s.token('admin', 'admin', {exp: Date.now() - 1}) : s.token('test-primary', 'auxiliar');
      assert.equal(s.post(s.body(action, {token})).ok, false); assert.equal(s.state.writes, 0);
    });
  }
}

for (const action of ['savedoc', 'saveperiodos']) {
  test(action + ': teacher cannot administer configuration', () => {
    const s = setup();
    assert.equal(s.post(s.body(action, {token: s.primary})).ok, false); assert.equal(s.state.writes, 0);
  });
}

for (const action of ['savereg', 'saveArea']) {
  const table = action === 'savereg' ? 'RegistroNotas' : 'EstadosAreas';
  test(action + ': primary assigned grade accepted; identity and canonical key enforced', () => {
    const s = setup();
    const victimKey = action === 'savereg' ? 'primaria||I||2||Única||Comunicación' : 'primaria|I|SEGUNDO|UNICA|Comunicación';
    const victim = [victimKey, 'primaria', 'I', '2', 'Única', 'Comunicación', 'Other Teacher', 100, 'unchanged'];
    s.tables.get(table).rows.push([...victim]);
    const response = s.post(s.body(action, {token: s.primary, grado: action === 'savereg' ? 1 : 'PRIMERO', clave: victimKey, docente: 'Forged Name'}));
    assert.equal(response.ok, true);
    assert.equal(response.clave, action === 'savereg' ? 'primaria||I||1||Única||Comunicación' : 'primaria|I|PRIMERO|UNICA|Comunicación');
    assert.deepEqual(s.tables.get(table).rows[1], victim);
    assert.equal(s.tables.get(table).rows[2][6], 'Test Primary');
    if (action === 'savereg') assert.deepEqual(JSON.parse(s.tables.get(table).rows[2][8]).meta, {docente: 'Test Primary', observacion: 'Preserved field'});
  });
  for (const extra of [{grado: 2}, {nivel: 'secundaria', grado: 1, seccion: 'A'}]) {
    test(action + ': primary rejects unassigned grade/level ' + JSON.stringify(extra), () => {
      const s = setup();
      assert.equal(s.post(s.body(action, {token: s.primary, ...extra})).ok, false); assert.equal(s.state.writes, 0);
    });
  }
  test(action + ': exact secondary area/aula relationship enforced', () => {
    const s = setup();
    const request = s.body(action, {token: s.secondary, nivel: 'secundaria', grado: action === 'savereg' ? 1 : '1°', seccion: 'A', area: 'Matemática', docente: 'Forged'});
    assert.equal(s.post(request).ok, true);
    assert.equal(s.tables.get(table).rows[1][6], 'Test Secondary');
    assert.equal(s.post({...request, grado: 5, seccion: 'UNICA', area: 'Ciencia y Tecnología'}).ok, true);
    const writes = s.state.writes;
    for (const extra of [{grado: 5, seccion: 'ÚNICA'}, {area: 'Ciencia y Tecnología'}, {seccion: 'C'}, {area: 'Unknown'}]) {
      assert.equal(s.post({...request, ...extra}).ok, false); assert.equal(s.state.writes, writes);
    }
  });
  test(action + ': legacy explicit areas+aulas remains compatible and restricted', () => {
    const s = setup();
    const request = s.body(action, {token: s.token('test-legacy'), nivel: 'secundaria', grado: 2, seccion: 'B', area: 'Matemática'});
    assert.equal(s.post(request).ok, true);
    const writes = s.state.writes;
    assert.equal(s.post({...request, seccion: 'A'}).ok, false);
    assert.equal(s.post({...request, area: 'Ciencia y Tecnología'}).ok, false);
    assert.equal(s.post({...request, token: s.token('test-empty')}).ok, false);
    assert.equal(s.state.writes, writes);
  });
  test(action + ': revoked teacher rejected immediately after admin savedoc', () => {
    const s = setup();
    assert.equal(s.post(s.body(action, {token: s.primary})).ok, true);
    assert.equal(s.post(s.body('savedoc', {token: s.admin, ts: 2000})).ok, true);
    const writes = s.state.writes;
    assert.equal(s.post(s.body(action, {token: s.primary})).ok, false); assert.equal(s.state.writes, writes);
    assert.equal(s.post(s.body(action, {token: s.admin})).ok, true);
  });
  for (const role of ['primary', 'admin']) {
    test(action + ': closed/blocked bimestre remains readonly for ' + role, () => {
      const s = setup();
      for (const bimestre of ['II', 'III']) {
        const response = s.post(s.body(action, {token: s[role], bimestre}));
        assert.equal(response.ok, false); assert.equal(response.readonly, true); assert.equal(s.state.writes, 0);
      }
    });
  }
  test(action + ': delimiters or invalid context cannot collide with another key', () => {
    const s = setup();
    for (const extra of [{area: 'Comunicación|other'}, {grado: '1|2'}, {seccion: 'A|B'}, {bimestre: 'I|II'}, {nivel: 'other'}]) {
      assert.equal(s.post(s.body(action, {token: s.admin, ...extra})).ok, false); assert.equal(s.state.writes, 0);
    }
  });
  test(action + ': current grade/unique-section aliases target one canonical record', () => {
    const s = setup();
    for (const grado of [1, '1', '1°', 'PRIMERO']) {
      for (const seccion of ['Única', 'ÚNICA', 'UNICA']) {
        assert.equal(s.post(s.body(action, {token: s.primary, grado, seccion})).ok, true);
      }
    }
    assert.equal(s.tables.get(table).rows.length, 2);
  });
  test(action + ': claims/body permissions cannot grant a grade absent from server config', () => {
    const s = setup();
    const token = s.token('test-primary', 'docente', {grados: [2], areas: ['Unknown'], nivel: 'secundaria'});
    assert.equal(s.post(s.body(action, {token, grado: 2, user: 'admin', grados: [2]})).ok, false);
    assert.equal(s.state.writes, 0);
    assert.equal(s.post(s.body(action, {token})).ok, true);
  });
  test(action + ': malformed assignments cannot fall back to broader legacy permissions', () => {
    const s = setup();
    s.docentes[2].asignaciones = ['invalid'];
    s.tables.get('DocentesAcceso').rows[1][2] = JSON.stringify(s.docentes);
    assert.equal(s.post(s.body(action, {token: s.token('test-legacy'), nivel: 'secundaria', grado: 2, seccion: 'B', area: 'Matemática'})).ok, false);
    assert.equal(s.state.writes, 0);
  });
}

const clientRoot = process.argv[3] || path.join(__dirname, '..');
function readClient(file) {return fs.readFileSync(path.join(clientRoot, file), 'utf8');}
function clientFunction(file, name) {
  const html = readClient(file);
  const match = new RegExp('^( *)(?:async )?function ' + name + '\\([^)]*\\)\\s*\\{', 'm').exec(html);
  assert.ok(match, 'Missing client function: ' + name);
  const end = html.indexOf('\n' + match[1] + '}', match.index);
  assert.ok(end > match.index);
  return html.slice(match.index, end + match[1].length + 2);
}

for (const file of ['admin.html', 'registro.html', 'primaria.html', 'secundaria.html']) {
  test(file + ': all inline JavaScript parses', () => {
    for (const match of readClient(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      new vm.Script(match[1], {filename: file});
    }
  });
}

for (const [file, name, action] of [
  ['admin.html', 'savePeriodos', 'saveperiodos'],
  ['admin.html', 'subirDocentesNube', 'savedoc'],
  ['registro.html', 'subirRegistroNube', 'savereg'],
  ['primaria.html', 'enviarAreaANube', 'saveArea'],
  ['secundaria.html', 'subirNube', 'saveArea']
]) {
  test(file + ': ' + name + ' sends session token and backend accepts current payload', async () => {
    const s = setup();
    const secondary = file === 'secundaria.html';
    const admin = file === 'admin.html';
    const token = admin ? s.admin : secondary ? s.secondary : s.primary;
    const requests = [];
    const responses = [];
    const storage = {getItem: () => JSON.stringify({token}), setItem() {}};
    const context = vm.createContext({
      sessionStorage: storage, localStorage: storage,
      window: {__IE_SES: {token}}, getLoginSession: () => ({token}),
      fetch: async (url, options) => {
        const body = JSON.parse(options.body); requests.push(body);
        const response = s.post(body); responses.push(response);
        return {text: async () => JSON.stringify(response), json: async () => response};
      },
      CLOUD_API_URL: 'test-url', CLOUD_NIVEL: secondary ? 'secundaria' : 'primaria',
      nivel: 'primaria', areaActual: 'Comunicación',
      ctxBase: () => ({nivel: 'primaria', bim: 'I', grado: 1, seccion: 'Única', area: 'Comunicación'}),
      sliceRegistroArea: () => ({meta: {docente: 'Forged Name', observacion: 'Preserved field'}, ts: 1}),
      cloudClaveReg: () => 'forged-key', cloudClave: () => 'forged-key',
      estado: {bimestre: 'I', grado: secondary ? '1°' : 'PRIMERO', seccion: secondary ? 'A' : 'UNICA', areaActual: secondary ? 'Matemática' : 'Comunicación', datos: {}},
      getNombreDocente: () => 'Forged Name', getDocenteArea: () => 'Forged Name', getTotalEstudiantes: () => 1,
      guardarTodo() {}, toast() {}, alert() {}, mostrarToast() {}, saveEstado() {}, initPeriodosUI() {},
      impedirEdicionPeriodo: () => false, storageDisponible: false,
      loadDocentes: () => s.docentes, loadPeriodos: () => ({bimestres: {I: 'abierto'}}),
      LS_PER: 'test-periodos', PERIODOS_CLOUD_KEY: 'test-periodos-cloud',
      document: {getElementById: () => ({value: '2026'}), querySelectorAll: () => []}
    });
    if (admin) new vm.Script(clientFunction(file, 'tokenSesionAdmin')).runInContext(context);
    new vm.Script(clientFunction(file, name)).runInContext(context);
    await context[name](secondary ? 'Matemática' : 'Comunicación');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].action, action);
    assert.equal(requests[0].token, token);
    assert.equal(responses[0].ok, true);
  });
}


test('savereg: meta remains an object through save, loadreg and the unchanged client merge', () => {
  const s = setup();
  const meta = {docente: 'Forged Name', observacion: 'Keep this', extra: {value: 7}};
  const response = s.post(s.body('savereg', {token: s.primary, docente: 'Forged Name', payload: {meta, capsSel: {test: true}}}));
  assert.equal(response.ok, true);
  const stored = s.tables.get('RegistroNotas').rows[1];
  assert.equal(stored[6], 'Test Primary');
  const savedMeta = JSON.parse(stored[8]).meta;
  assert.equal(typeof savedMeta, 'object');
  assert.equal(Array.isArray(savedMeta), false);
  assert.deepEqual(savedMeta, {...meta, docente: 'Test Primary'});
  // The source request must not be mutated.
  assert.equal(meta.docente, 'Forged Name');

  const loaded = JSON.parse(s.c.doGet({parameter: {action: 'loadreg', nivel: 'primaria'}}).text);
  assert.equal(loaded.ok, true);
  const item = loaded.items.find(item => item.clave === response.clave);
  assert.ok(item);
  assert.equal(item.docente, 'Test Primary');
  assert.deepEqual(item.payload.meta, savedMeta);

  const store = {sessions: [], grades: {}, meta: {[response.clave]: {localField: true}}};
  const context = vm.createContext({store, cloudClaveReg: () => response.clave});
  new vm.Script(clientFunction('registro.html', 'mergeRegistroPayload')).runInContext(context);
  context.mergeRegistroPayload(item.payload);
  assert.deepEqual(JSON.parse(JSON.stringify(store.meta[response.clave])), {
    localField: true, ...meta, docente: 'Test Primary'
  });
  assert.equal(Object.hasOwn(store.meta[response.clave], '0'), false);
});

test('savereg: admin metadata object remains unchanged', () => {
  const s = setup();
  const meta = {docente: 'Admin-selected responsible teacher', observacion: 'Keep this'};
  assert.equal(s.post(s.body('savereg', {token: s.admin, docente: 'Responsible teacher', payload: {meta}})).ok, true);
  const row = s.tables.get('RegistroNotas').rows[1];
  assert.equal(row[6], 'Responsible teacher');
  assert.deepEqual(JSON.parse(row[8]).meta, meta);
});

for (const meta of [undefined, null, 'legacy text']) {
  test('savereg: missing or non-object meta uses dedicated identity field (' + String(meta) + ')', () => {
    const s = setup();
    assert.equal(s.post(s.body('savereg', {token: s.primary, payload: {meta}})).ok, true);
    assert.deepEqual(JSON.parse(s.tables.get('RegistroNotas').rows[1][8]).meta, {docente: 'Test Primary'});
  });
}
