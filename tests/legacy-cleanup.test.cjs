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
  const redirects = [], alerts = [], downloads = [], studentWrites = [];
  const document = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '.tab' ? [...elements].filter(([id]) => id.startsWith('tab-')).map(([,el]) => el) : selector === '.doc-grado:checked' ? [{value: '1'}] : [],
    createElement: () => ({click() {downloads.push(this);}})
  };
  const context = vm.createContext({
    document, window: {addEventListener() {}}, localStorage: storage, sessionStorage: storage,
    location: {replace: value => redirects.push(value)}, alert: value => alerts.push(value), confirm: () => true,
    Blob, URL: {createObjectURL: () => 'synthetic-blob-url'}, console,
    IEStudents: {
      empty: () => JSON.parse(JSON.stringify(fixture)),
      load: async () => ({...JSON.parse(JSON.stringify(fixture)), version: 'synthetic-version', inicializada: true}),
      save: async (base, version) => {studentWrites.push({action:'savestudents',base:JSON.parse(JSON.stringify(base)),version});return {...JSON.parse(JSON.stringify(base)),version:'saved-version',inicializada:true};},
      initialize: async (base, version) => {studentWrites.push({action:'initstudents',base,version});return {...JSON.parse(JSON.stringify(base)),version:'initial-version',inicializada:true};},
      restore: async version => {studentWrites.push({action:'restorestudents',version});return {...JSON.parse(JSON.stringify(fixture)),version:'restored-version',inicializada:true};}
    },
    fetch: async () => {throw new Error('Unexpected network call in bootstrap');}
  });
  // Synthetic students only; no production fixture is printed or persisted by these tests.
  const fixture = {anio: 2026, primaria: {estudiantes: [], docentes: []}, secundaria: {estudiantes: [], docentes: []}};
  for (const script of inline(html)) new vm.Script(script).runInContext(context);
  return {context, elements, memory, redirects, alerts, downloads, studentWrites};
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
  await s.context.cargarEstudiantesAdmin();
  const fixture = {anio: 2026, primaria: {estudiantes: [{nivel: 'primaria', grado: 1, seccion: 'Única', nombre: 'Synthetic Student', orden: 1}], docentes: []}, secundaria: {estudiantes: [], docentes: []}};
  await s.elements.get('importFile').listeners.change({target: {files: [{name: 'synthetic-students.json', text: async () => JSON.stringify(fixture)}]}});
  s.elements.get('importModo').value = 'replace'; s.elements.get('importNivel').value = 'ambos';
  s.context.procesarImport();
  assert.equal(s.context.estudiantesDe('primaria').length, 1);
  s.context.exportarJSON();
  assert.equal(s.downloads[0].download, 'estudiantes_respaldo.json');
});

test('Admin import/edit/save/restore uses server revisions and leaves old local backups untouched', async()=>{
  const s=admin({user:'admin',role:'admin'});await s.context.cargarEstudiantesAdmin();
  s.memory.set('ie22375_admin_bd_v1','synthetic-legacy-backup');
  s.context.window._importCSV=s.context.parseCSV('nivel,grado,seccion,orden,nombre\nprimaria,1,Única,1,"Synthetic, Student"');
  s.elements.get('importModo').value='replace';s.elements.get('importNivel').value='primaria';
  s.context.procesarImport();assert.equal(s.context.estudiantesDe('primaria').length,1);
  const alumno=s.context.estudiantesDe('primaria')[0];alumno.nombre='Synthetic Edited Student';
  s.context.saveEstado();await s.context.guardarBD();
  assert.equal(s.studentWrites[0].action,'savestudents');assert.equal(s.studentWrites[0].version,'synthetic-version');
  assert.equal(s.studentWrites[0].base.primaria.estudiantes[0].nombre,'Synthetic Edited Student');
  await s.context.restaurarBDOficial();
  assert.equal(s.studentWrites[1].action,'restorestudents');assert.equal(s.studentWrites[1].version,'saved-version');
  assert.equal(s.context.estudiantesDe('primaria').length,0);
  assert.equal(s.memory.get('ie22375_admin_bd_v1'),'synthetic-legacy-backup');
});
test('Legacy CSV parser default remains compatible with previous grade/section formats', async()=>{
  const s=admin({user:'admin',role:'admin'});await s.context.cargarEstudiantesAdmin();
  const csv='NumeroDeOrden;ApellidoPaterno;ApellidoMaterno;NombreEstudiante;Grado;Seccion;EstadoMatricula;Nivel\n1;SYNTHETIC;ONE;STUDENT;PRIMERO;UNICA;DEFINITIVA;primaria\n2;SYNTHETIC;TWO;STUDENT;PRIMERO;UNICA;TRASLADADO;primaria';
  s.context.window._importCSV=s.context.parseCSV(csv);
  s.elements.get('importModo').value='replace';s.elements.get('importNivel').value='primaria';s.context.procesarImport();
  assert.equal(s.context.estudiantesDe('primaria').length,1);assert.equal(s.context.estudiantesDe('primaria')[0].grado,1);
  await s.context.guardarBD();assert.equal(s.studentWrites[0].base.primaria.estudiantes.length,1);
});

test('Active Admin CSV upload includes transferred students before private save',async()=>{
  const s=admin({user:'admin',role:'admin'});await s.context.cargarEstudiantesAdmin();
  const csv='NumeroDeOrden;ApellidoPaterno;ApellidoMaterno;NombreEstudiante;Grado;Seccion;EstadoMatricula;Nivel\n1;SYNTHETIC;ONE;STUDENT;PRIMERO;UNICA;DEFINITIVA;primaria\n2;SYNTHETIC;TWO;STUDENT;PRIMERO;UNICA;TRASLADADO;primaria';
  await s.elements.get('importFile').listeners.change({target:{files:[{name:'synthetic.csv',text:async()=>csv}]}});
  s.elements.get('importModo').value='replace';s.elements.get('importNivel').value='primaria';s.context.procesarImport();await s.context.guardarBD();
  assert.equal(s.studentWrites[0].base.primaria.estudiantes.length,2);
  assert.equal(s.studentWrites[0].base.primaria.estudiantes[1].estadoMatricula,'TRASLADADO');
});
test('Failed Admin save keeps the reviewed draft and displays the error', async()=>{
  const s=admin({user:'admin',role:'admin'});await s.context.cargarEstudiantesAdmin();
  s.context.window._importJSON={primaria:{estudiantes:[{grado:1,seccion:'Única',nombre:'Synthetic Draft'}]},secundaria:{estudiantes:[]}};
  s.elements.get('importModo').value='replace';s.elements.get('importNivel').value='ambos';s.context.procesarImport();
  s.context.IEStudents.save=async()=>{throw Error('Synthetic conflict');};
  await s.context.guardarBD();assert.equal(s.context.estudiantesDe('primaria')[0].nombre,'Synthetic Draft');
  assert.equal(s.elements.get('bdEstado').textContent,'Synthetic conflict');
});
test('Admin cannot edit or save an empty placeholder while students are loading',()=>{
  const s=admin({user:'admin',role:'admin'});
  s.context.window._importJSON={primaria:{estudiantes:[{nombre:'Synthetic'}]},secundaria:{estudiantes:[]}};
  s.context.procesarImport();assert.equal(s.context.estudiantesDe('primaria').length,0);assert.equal(s.studentWrites.length,0);
});

test('No embedded-data initialization control reappears; initial SIAGIE review stays manual',()=>{
  const s=admin({user:'admin',role:'admin'});
  assert.equal(typeof s.context.inicializarBDOficial,'undefined');
  assert.doesNotMatch(read('admin.html'),/onclick="inicializarBDOficial/);
  assert.match(read('admin.html'),/IEMigrateStudents\.inicializar\(\)/);
});


test('UI refinements keep Registro Promedios compact and cloud actions explicit', () => {
  const src = read('registro.html');
  assert.match(src, /Nube Subir/);
  assert.match(src, /Nube Bajar/);
  assert.doesNotMatch(src, />Nube [↑↓]</);
  assert.match(src, /max-width:104px/);
  assert.match(src, /fin-grid thead th\.av-prom-col/);
  assert.match(src, /class="av-prom-col">Promedio/);
  assert.doesNotMatch(src, /fin-grid tbody td:not\(\.fin-nom\)/);
  assert.match(src, /viewHome[^>]*min-h-screen[^>]*justify-center/);
});

for (const file of ['primaria.html', 'secundaria.html']) {
  test(file + ': all roles hide aggregate summary cards and comparative has no redundant back controls', () => {
    const src = read(file);
    const summary = src.slice(src.indexOf('function renderizarResumen()'), src.indexOf('// VISTA TABLA CONSOLIDADA'));
    assert.doesNotMatch(summary, /__IE_SES|Progreso General|Inicio \(C\)|En Proceso \(B\)|Logrado \(A\+AD\)/);
    assert.match(src, /container\.classList\.add\('hidden'\)/);
    assert.match(src, /container\.innerHTML = ''/);
    assert.doesNotMatch(src, /← Volver a áreas|>← Volver</);
    assert.match(src, /Nube Subir/);
    assert.match(src, /Nube Bajar/);
  });
}

test('Secundaria comparative reads only the exact requested section and shows responsible teacher on mobile', () => {
  const src = read('secundaria.html');
  assert.match(src, /sec !== secObjetivo/);
  assert.match(src, /Docente responsable: \$\{docente \|\| 'Sin registrar'\}/);
});


test('Registro keeps cloud actions on one mobile row', () => {
  const src = read('registro.html');
  assert.match(src, /grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex/);
  const subir = src.indexOf('Nube Subir');
  const bajar = src.indexOf('Nube Bajar');
  const guardar = src.indexOf(">Guardar</button>", bajar);
  assert.ok(subir >= 0 && bajar > subir && guardar > bajar);
});


test('Secundaria Desde registro never mixes notes between A and B', () => {
  const src = read('secundaria.html');
  assert.match(src, /secSesion!==secActual/);
  assert.match(src, /secNota!==secActual/);
  assert.match(src, /p\[1\]!==bim/);
  assert.match(src, /String\(p\[2\]\)!==gradoN/);
  assert.match(src, /String\(p\[6\] \|\| ''\) !== String\(s\.capacidad \|\| ''\)/);
  assert.match(src, /String\(p\[7\] \|\| ''\) !== String\(s\.fecha \|\| ''\)/);
});


test('Secundaria shows responsible teacher as compact read-only label', () => {
  const src = read('secundaria.html');
  assert.match(src, /Docente responsable: \$\{docente \|\| 'Sin registrar'\}/);
  assert.match(src, /mx-auto w-full max-w-2xl text-center/);
  assert.doesNotMatch(src, /id="docenteAreaInput"/);
  assert.doesNotMatch(src, /oninput="setDocenteArea\(estado\.areaActual, this\.value\)"/);
});


test('Registro routes mobile quick tools to official app stores while keeping desktop web links', () => {
  const src = read('registro.html');
  assert.match(src, /data-mobile-app="classroom"/);
  assert.match(src, /data-mobile-app="gemini"/);
  assert.match(src, /data-mobile-app="notebook"/);
  assert.match(src, /apps\.apple\.com\/pe\/app\/google-classroom\/id924620788/);
  assert.match(src, /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.classroom/);
  assert.match(src, /apps\.apple\.com\/pe\/app\/google-gemini\/id6477489729/);
  assert.match(src, /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.bard/);
  assert.match(src, /apps\.apple\.com\/pe\/app\/gemini-notebook\/id6737527615/);
  assert.match(src, /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.labs\.language\.tailwind/);
  assert.match(src, /https:\/\/classroom\.google\.com\//);
  assert.match(src, /https:\/\/gemini\.google\.com\//);
  assert.match(src, /https:\/\/notebooklm\.google\.com\//);
});


test('Secundaria comparative is limited to admin/director or same teacher with two sections in the same area and grade', () => {
  const src = read('secundaria.html');
  assert.match(src, /function seccionesAsignadasAreaGrado/);
  assert.match(src, /ses\.asignaciones && Array\.isArray\(ses\.asignaciones\[area\]\)/);
  assert.match(src, /return seccionesAsignadasAreaGrado\(area, grado\)\.length >= 2/);
  assert.match(src, /areasComparablesGrado\(estado\.grado\)/);
  assert.match(src, /No tienes ambas secciones asignadas en esta área y grado/);
  assert.match(src, /id="btnComparativo"/);
});


test('Admin has whole-grade consolidated comparison across all sections with data', () => {
  const src = read('secundaria.html');
  assert.match(src, /id="btnResumenGradoAdmin"/);
  assert.match(src, /function esAdminDirector\(\)/);
  assert.match(src, /function seccionesConDatosAreaGrado/);
  assert.match(src, /function datoCompGradoCompleto/);
  assert.match(src, /function abrirResumenGradoAdmin/);
  assert.match(src, /function renderResumenGradoAdmin/);
  assert.match(src, /id="chartResumenGradoAdmin"/);
  assert.match(src, /Secciones incluidas:/);
  assert.match(src, /stack:'g'/);
});


test('Secundaria hides obsolete global summary cards for all roles', () => {
  const src = read('secundaria.html');
  const block = src.slice(src.indexOf('function renderizarResumen()'), src.indexOf('// VISTA TABLA CONSOLIDADA'));
  assert.match(block, /container\.classList\.add\('hidden'\)/);
  assert.doesNotMatch(block, /Progreso General|Inicio \(C\)|En Proceso \(B\)|Logrado \(A\+AD\)/);
});


test('Areas actions stack title above and keep buttons in one horizontal row', () => {
  for (const file of ['primaria.html', 'secundaria.html']) {
    const src = read(file);
    assert.match(src, /Áreas Curriculares/);
    assert.match(src, /flex flex-nowrap sm:flex-wrap items-center justify-start gap-2 overflow-x-auto/);
    assert.match(src, /px-4 py-2\.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0/);
    assert.match(src, /mt-2 text-xs text-slate-500">Haz clic en un área para editar/);
  }
});


test('Registro preserves original grade when switching scoring modes', () => {
  const src = read('registro.html');
  assert.match(src, /Cambiar entre Letras y 0–20 solo cambia la forma de calificar; no modifica las notas ya guardadas/);
  assert.match(src, /origen: 'numero'/);
  assert.match(src, /origen: 'letra'/);
  assert.match(src, /Se conserva la calificación original/);
});


test('Admin top actions center link and button labels consistently', () => {
  const src = read('admin.html');
  assert.match(src, /\.mobile-top-actions > a, \.mobile-top-actions > button \{/);
  assert.match(src, /display:inline-flex; align-items:center; justify-content:center; text-align:center; line-height:1\.15/);
});


test('Admin no longer shows obsolete note that transferred students are omitted', () => {
  const src = read('admin.html');
  assert.doesNotMatch(src, /Nota: solo se cuentan alumnos con matrícula/);
  assert.doesNotMatch(src, /Los <b>TRASLADADOS<\/b> del SIAGIE se omiten/);
});


test('Admin schedule panel removes obsolete JSON download/import controls and legacy GitHub instruction', () => {
  const src = read('admin.html');
  assert.doesNotMatch(src, /Descargar horario_ingreso\.json/);
  assert.doesNotMatch(src, /Importar JSON<input type="file"/);
  assert.doesNotMatch(src, /descargue el JSON y súbalo a GitHub como/);
  assert.match(src, /onclick="guardarHorario\(\)">Guardar horario/);
});


test('Admin labels backup section clearly', () => {
  const src = read('admin.html');
  assert.match(src, />Respaldo<\/button>/);
  assert.match(src, /<h2 class="font-black text-lg">Respaldo y exportación<\/h2>/);
});


test('Admin register resolves responsible teacher from admin assignments and locks field', () => {
  const src = read('registro.html');
  assert.match(src, /function nombreDocenteTexto/);
  assert.match(src, /function docenteAsignadoAdmin/);
  assert.match(src, /function actualizarDocenteResponsable/);
  assert.match(src, /Definido en Admin · Docentes y accesos/);
  assert.match(src, /inp\.readOnly = true/);
  assert.doesNotMatch(src, /inp\.value = \(\(store\.meta\[mk\]/);
});


test('Registro resolves primary responsible teacher after initial area becomes active', () => {
  const src = read('registro.html');
  assert.match(src, /areaActual = areas\(\)\[0\] \|\| null;[\s\S]*actualizarDocenteResponsable\(\);/);
  assert.match(src, /function docenteAsignadoAdmin\(\)[\s\S]*d\.nivel !== c\.nivel/);
  assert.match(src, /Array\.isArray\(d\.grados\) && d\.grados\.map\(Number\)\.includes\(Number\(c\.grado\)\)/);
});


test('Login retries once and distinguishes transient backend failures', () => {
  const src = read('index.html');
  assert.match(src, /for \(let intento = 1; intento <= 2; intento\+\+\)/);
  assert.match(src, /await esperar\(1200\)/);
  assert.match(src, /errorLogin\('TIMEOUT'/);
  assert.match(src, /e\.code \|\| 'NETWORK'/);
  assert.match(src, /INVALID_RESPONSE/);
  assert.match(src, /mensajeErrorLogin\(e\)/);
  assert.match(src, /ie22375_login_error_v1/);
  assert.match(src, /retryCount: perfil\.__retryCount \|\| 0/);
});


test('Admin shows authorized cached student base immediately while refreshing server data', () => {
  const src = read('admin.html');
  assert.match(src, /IEStudents\.peek \? IEStudents\.peek\(\) : null/);
  assert.match(src, /Base reciente mostrada al instante\. Verificando datos con el servidor/);
  assert.match(src, /cargarEstudiantesAdmin\(\{forceNetwork:true\}\)/);
  assert.match(src, /const fresca = await IEStudents\.load\(\)/);
});


test('Login tolerates slower Apps Script cold starts and reports automatic retry', () => {
  const src = read('index.html');
  assert.match(src, /}, 18000\)/);
  assert.match(src, /Reintentando automáticamente/);
  assert.match(src, /Se hicieron 2 intentos/);
});
