const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const inline = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  test(file + ': every inline script still parses', () => {
    for (const script of inline(read(file))) new vm.Script(script, {filename: file});
  });
}

function admin(session, oldFlag = false) {
  const html = read('admin.html');
  const elements = new Map();
  for (const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const classes = new Set((/class="([^"]*)"/.exec(m[0])?.[1] || '').split(/\s+/));
    const listeners = {};
    const el = {
      value: /value="([^"]*)"/.exec(m[0])?.[1] || '', style: {}, textContent: '', innerHTML: '', children: [], options: [],
      classList: {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value), toggle(value, force) {if (force) classes.add(value); else classes.delete(value);}},
      addEventListener: (name, fn) => listeners[name] = fn,
      querySelectorAll: () => [], listeners
    };
    elements.set(m[1], el);
  }
  elements.get('filtroNivel').value = 'primaria';
  elements.get('docNivel').value = 'primaria';
  const memory = new Map(session ? [['ie22375_session_v1', JSON.stringify(session)]] : []);
  if (oldFlag) memory.set('ie22375_admin_ok', '1');
  const storage = {getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key)};
  const redirects = [], alerts = [], downloads = [];
  const document = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '.tab' ? [...elements].filter(([id]) => id.startsWith('tab-')).map(([,el]) => el) : selector === '.doc-grado:checked' ? [{value: '1'}] : [],
    createElement: () => ({click() {downloads.push(this);}})
  };
  const context = vm.createContext({
    document, window: {}, localStorage: storage, sessionStorage: storage,
    location: {replace: value => redirects.push(value)}, alert: value => alerts.push(value), confirm: () => true,
    Blob, URL: {createObjectURL: () => 'synthetic-blob-url'}, console,
    fetch: async () => {throw new Error('Unexpected network call in bootstrap');}
  });
  // Synthetic students only; no production fixture is printed or persisted by these tests.
  const fixture = {anio: 2026, primaria: {estudiantes: [], docentes: []}, secundaria: {estudiantes: [], docentes: []}};
  for (const script of inline(html)) new vm.Script(script.replace(/^const BD_EMPOTRADA = .*;$/m, 'const BD_EMPOTRADA = ' + JSON.stringify(fixture) + ';')).runInContext(context);
  return {context, elements, memory, redirects, alerts, downloads};
}

test('Admin session opens the panel and Docentes without the removed login controls', () => {
  const s = admin({user: 'admin', role: 'admin', token: 'synthetic-session-token'});
  assert.deepEqual(s.redirects, []);
  assert.equal(s.elements.get('screenApp').classList.contains('active'), true);
  assert.equal(s.elements.has('screenLogin'), false);
  assert.equal(s.elements.has('loginPass'), false);
  s.context.showTab('docentes');
  assert.equal(s.elements.get('tab-docentes').classList.contains('hidden'), false);
  assert.match(s.elements.get('docLista').innerHTML, /Aún no hay docentes/);
  assert.equal(s.context.tokenSesionAdmin(), 'synthetic-session-token');
});

test('Absent session and a legacy flag cannot open Admin; teacher is redirected', () => {
  for (const session of [null, {user: 'synthetic-teacher', role: 'docente', nivel: 'primaria'}]) {
    const s = admin(session, true);
    assert.deepEqual(s.redirects, ['index.html']);
    assert.equal(s.elements.get('screenApp').classList.contains('active'), false);
  }
});

test('Docentes form still saves and renders a teacher through the current flow', () => {
  const s = admin({user: 'admin', role: 'admin'});
  s.context.showTab('docentes');
  s.elements.get('docUser').value = 'synthetic-teacher';
  s.elements.get('docPass').value = 'synthetic-test-password';
  s.elements.get('docNombre').value = 'Synthetic Teacher';
  s.context.guardarDocente();
  const teachers = s.context.loadDocentes();
  assert.equal(teachers.length, 1); assert.equal(teachers[0].user, 'synthetic-teacher');
  assert.deepEqual(Array.from(teachers[0].grados), [1]);
  assert.match(s.elements.get('docLista').innerHTML, /Synthetic Teacher/);
  assert.equal(typeof s.context.subirDocentesNube, 'function');
  assert.equal(typeof s.context.bajarDocentesNube, 'function');
});

test('Student JSON import listener and full backup export remain usable', async () => {
  const s = admin({user: 'admin', role: 'admin'});
  const fixture = {anio: 2026, primaria: {estudiantes: [{nivel: 'primaria', grado: 1, seccion: 'Única', nombre: 'Synthetic Student', orden: 1}], docentes: []}, secundaria: {estudiantes: [], docentes: []}};
  await s.elements.get('importFile').listeners.change({target: {files: [{name: 'synthetic-students.json', text: async () => JSON.stringify(fixture)}]}});
  s.elements.get('importModo').value = 'replace'; s.elements.get('importNivel').value = 'ambos';
  s.context.procesarImport();
  assert.equal(s.context.estudiantesDe('primaria').length, 1);
  s.context.exportarJSON();
  assert.equal(s.downloads[0].download, 'bd_oficial_2026.json');
});
