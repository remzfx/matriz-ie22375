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
  return {c, post, token, primary, secondary, admin, body, state, tables, docentes, cacheEntries, sheet};
}



function studentsFixture() {
  const s = setup();
  let id = 0;
  s.c.Utilities.getUuid = () => 'synthetic-version-' + (++id);
  const rows = [
    ['primaria',1,'Única'], ['primaria',2,'Única'], ['primaria',3,'Única'],
    ['secundaria',1,'A'], ['secundaria',1,'B'], ['secundaria',5,'Única'], ['secundaria',2,'B']
  ].map((a,i) => ({nivel:a[0],grado:a[1],seccion:a[2],orden:1,nombre:'Synthetic Student '+i,unused:'private-extra'}));
  const base = {primaria:{estudiantes:rows.filter(a=>a.nivel==='primaria')},secundaria:{estudiantes:rows.filter(a=>a.nivel==='secundaria')}};
  const init = s.post({action:'initstudents',token:s.admin,version:'',base});
  assert.equal(init.ok,true);
  const get = params => JSON.parse(s.c.doGet({parameter:params}).text);
  const load = (token, extra={}) => s.post({action:'loadstudents',token,...extra});
  return {...s,rows,base,init,load,get};
}

test('Admin reads the complete private base with exactly the five consumer fields',()=> {
  const s=studentsFixture(),res=s.load(s.admin);
  assert.equal(res.ok,true);assert.equal(res.estudiantes.length,7);
  for(const a of res.estudiantes)assert.deepEqual(Object.keys(a).sort(),['grado','nivel','nombre','orden','seccion']);
  assert.equal(res.inicializada,true);
});
test('Primary teacher reads only server-assigned grades',()=> {
  const s=studentsFixture(),res=s.load(s.primary);
  assert.deepEqual(res.estudiantes.map(a=>a.nombre),['Synthetic Student 0','Synthetic Student 2']);
});
test('Secondary teacher reads only the union of exact area-to-aula assignments',()=> {
  const s=studentsFixture();
  // Deliberately broaden the legacy aulas/areas arrays; the exact map must win.
  s.docentes[1].aulas.push('2|B');s.docentes[1].areas.push('Other');
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);
  s.cacheEntries.clear();
  assert.deepEqual(s.load(s.secondary).estudiantes.map(a=>a.nombre),['Synthetic Student 3','Synthetic Student 4','Synthetic Student 5']);
});
test('Legacy secondary format retains its existing explicit aula scope',()=> {
  const s=studentsFixture();assert.deepEqual(s.load(s.token('test-legacy')).estudiantes.map(a=>a.nombre),['Synthetic Student 6']);
});
test('Empty authorization returns no students',()=> {
  const s=studentsFixture();assert.deepEqual(s.load(s.token('test-empty')).estudiantes,[]);
});
for(const tokenKind of ['primary','secondary'])test(tokenKind+': forged filters, role, identity and permissions never enlarge scope',()=> {
  const s=studentsFixture(),token=s[tokenKind];
  const normal=s.load(token);
  for(const filter of [{role:'admin',user:'admin',nivel:'secundaria',grado:2,seccion:'B',areas:['Other'],grados:[1,2,3,4,5,6],asignaciones:{Other:['2|B']}},{nivel:'primaria',grado:6,seccion:'A',area:'Other'}]){
    assert.deepEqual(s.load(token,filter).estudiantes,normal.estudiantes);
  }
});
test('Auxiliar retains the school-wide student scope',()=> {
  const s=studentsFixture();assert.equal(s.load(s.token('auxiliar','auxiliar')).estudiantes.length,7);
});
for(const kind of ['missing','expired','tampered','revoked','removed','pip','malformed-map'])test('Student read rejects '+kind+' without returning names',()=> {
  const s=studentsFixture();let token=s.primary;
  if(kind==='missing')token=undefined;
  if(kind==='expired')token=s.token('test-primary','docente',{exp:Date.now()-1});
  if(kind==='tampered')token=s.primary.split('.')[0]+'.invalid-signature';
  if(kind==='revoked')token=s.token('test-primary','docente',{permisosVersion:999});
  if(kind==='removed')token=s.token('removed-teacher');
  if(kind==='pip')token=s.token('pip','pip');
  if(kind==='malformed-map'){
    s.docentes[1].asignaciones=['1|A'];s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();token=s.secondary;
  }
  const before=s.state.writes,res=s.load(token);
  assert.equal(res.ok,false);assert.equal('estudiantes' in res,false);assert.equal(s.state.writes,before);
});
test('Revocation while waiting for the student lock is checked again without nested locks',()=> {
  const s=studentsFixture();s.c.obtenerDocentesConfig_();
  s.c.LockService.getScriptLock=()=>({waitLock(){assert.equal(s.state.held,false);s.state.held=true;s.tables.get('DocentesAcceso').rows[1][1]=2000;},releaseLock(){s.state.held=false;}});
  assert.equal(s.load(s.primary).ok,false);assert.equal(s.state.held,false);
});
for(const action of ['loadstudents','savestudents','initstudents','restorestudents'])test(action+': GET never exposes students or changes the private base',()=> {
  const s=studentsFixture(),before=s.state.writes,res=s.get({action,token:s.admin,base:s.base});
  assert.equal(res.ok,false);assert.equal('estudiantes' in res,false);assert.equal(s.state.writes,before);
});
for(const action of ['savestudents','initstudents','restorestudents'])test(action+': only Admin may administer the student base',()=> {
  const s=studentsFixture();
  for(const token of [undefined,s.primary,s.secondary,s.token('auxiliar','auxiliar'),s.token('pip','pip'),s.token('admin','admin',{exp:Date.now()-1})]){
    const before=s.state.writes,res=s.post({action,token,base:s.base,version:s.init.version});
    assert.equal(res.ok,false);assert.equal(s.state.writes,before);
  }
});
test('Admin import/edit/save/load and private official restoration preserve the baseline',()=> {
  const s=studentsFixture();
  s.base.primaria.estudiantes[0].nombre='Synthetic Edited Student';
  const saved=s.post({action:'savestudents',token:s.admin,base:s.base,version:s.init.version});
  assert.equal(saved.ok,true);assert.notEqual(saved.version,s.init.version);
  assert.equal(s.load(s.admin).estudiantes[0].nombre,'Synthetic Edited Student');
  const restored=s.post({action:'restorestudents',token:s.admin,version:saved.version,base:{},role:'docente'});
  assert.equal(restored.ok,true);assert.equal(restored.estudiantes[0].nombre,'Synthetic Student 0');
  assert.notEqual(restored.version,s.init.version);
  assert.equal(s.post({action:'savestudents',token:s.admin,base:s.base,version:s.init.version}).code,'CONFLICT');
  assert.equal(s.post({action:'initstudents',token:s.admin,base:s.base,version:restored.version}).ok,false);
});
test('Failed/stale or malformed Admin changes never replace the authoritative base',()=> {
  const s=studentsFixture();
  for(const request of [{version:'stale',base:s.base},{version:s.init.version,base:{primaria:{estudiantes:[]}}},{version:s.init.version,base:{...s.base,primaria:{estudiantes:[{nombre:'Synthetic',grado:9,seccion:'A'}]}}}]){
    const before=s.state.writes;assert.equal(s.post({action:'savestudents',token:s.admin,...request}).ok,false);assert.equal(s.state.writes,before);
    assert.equal(s.load(s.admin).estudiantes.length,7);
  }
});
test('Large imports are chunked below Sheets cell limits and load without losing students',()=> {
  const s=studentsFixture();s.base.primaria.estudiantes=Array.from({length:900},(_,i)=>({nivel:'primaria',grado:1,seccion:'Única',orden:i+1,nombre:'Synthetic large student '+i}));
  const saved=s.post({action:'savestudents',token:s.admin,base:s.base,version:s.init.version});
  assert.equal(saved.ok,true);assert.equal(s.load(s.primary).estudiantes.length,900);
  for(const row of s.tables.get('EstudiantesBase').rows)assert.ok(String(row[2]).length<=30000);
});
test('Partial chunk write leaves the previous pointer and student list intact',()=> {
  const s=studentsFixture(),sh=s.tables.get('EstudiantesBase'),append=sh.appendRow;
  sh.appendRow=function(row){if(row[0]==='BASE_ACTUAL')throw Error('Synthetic interruption');append.call(this,row);};
  assert.equal(s.post({action:'savestudents',token:s.admin,base:s.base,version:s.init.version}).ok,false);
  assert.equal(s.load(s.admin).version,s.init.version);assert.equal(s.state.held,false);
});
test('Initial migration is explicit; saving an uninitialized base is rejected',()=> {
  const s=setup();let id=0;s.c.Utilities.getUuid=()=> 'initial-'+(++id);
  const load=s.post({action:'loadstudents',token:s.admin});assert.equal(load.inicializada,false);assert.deepEqual(load.estudiantes,[]);
  assert.equal(s.post({action:'savestudents',token:s.admin,version:'',base:{primaria:{estudiantes:[]},secundaria:{estudiantes:[]}}}).ok,false);
  assert.equal(s.post({action:'initstudents',token:s.admin,version:'',base:{primaria:{estudiantes:[]},secundaria:{estudiantes:[]}}}).ok,false);
});
