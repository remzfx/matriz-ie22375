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
    CacheService: {getScriptCache: () => ({get: key => cacheEntries.get(key) || null, put: (key, value, ttl) => {assert.equal(state.held, true); assert.equal(ttl, 21600); cacheEntries.set(key, value);}, remove: key => {assert.equal(state.held, true); cacheEntries.delete(key);}})},
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


function fixture() {
  const s = setup();
  s.state.driveReads = 0; s.state.classroomReads = 0;
  s.c.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64');
  s.c.DriveApp = {getFileById(id) {s.state.driveReads++; return {getBlob: () => ({getBytes: () => [...Buffer.from(id)]})};}};
  s.c.Classroom = {Courses: {list() {s.state.classroomReads++; return {courses: [{id: 'synthetic-course', name: 'Synthetic Course'}]};}}};
  s.c.ContentService.MimeType.JAVASCRIPT = 'javascript';
  const contexts = [
    ['primaria', '1', 'Única', 'Comunicación'], ['primaria', '2', 'Única', 'Comunicación'], ['primaria', '3', 'Única', 'Matemática'],
    ['secundaria', '1', 'A', 'Matemática'], ['secundaria', '1', 'B', 'Matemática'], ['secundaria', '5', 'Única', 'Ciencia y Tecnología'],
    ['secundaria', '5', 'Única', 'Matemática'], ['secundaria', '1', 'A', 'Ciencia y Tecnología'], ['secundaria', '2', 'B', 'Matemática']
  ];
  const expected = contexts.map((c, i) => c.join(':'));
  const prefix = c => [c[0], 'I', ...c.slice(1)].join('||');
  contexts.forEach((c, i) => {
    const key = prefix(c);
    const payload = {ts: 1, meta: {docente: 'Synthetic Teacher', observacion: 'Preserved'},
      sessions: [{nivel: c[0], bim: 'I', grado: c[1], seccion: c[2], area: c[3], comp: 'C1', capacidad: 'Cap', fecha: '2026-10-03'}],
      grades: {[key + '||C1||Cap||2026-10-03||Synthetic Student']: {nivel: 'A'}},
      finales: {[key + '||C1||Synthetic Student']: {nivel: 'A'}},
      concArea: {[key + '||Synthetic Student']: {texto: 'Synthetic'}},
      asistencia: {[key.split('||').slice(0,4).join('||') + '||2026-10-03||Synthetic Student']: {marca: 'P'}},
      capsSel: {[key + '||2026-10-03']: ['Cap']}};
    s.tables.get('RegistroNotas').rows.push([key, c[0], 'I', ...c.slice(1), 'Synthetic Teacher', 1, JSON.stringify(payload)]);
    const grade = c[0] === 'primaria' ? ['PRIMERO', 'SEGUNDO', 'TERCERO'][Number(c[1])-1] : c[1] + '°';
    const sec = c[2] === 'Única' ? (c[0] === 'primaria' ? 'UNICA' : 'ÚNICA') : c[2];
    s.tables.get('EstadosAreas').rows.push([[c[0], 'I', grade, sec, c[3]].join('|'), c[0], 'I', grade, sec, c[3], 'Synthetic Teacher', 1, 1, JSON.stringify({C1: {test: 'A'}})]);
  });
  s.sheet('SiagiePlantillas', [['clave','nivel','bimestre','grado','seccion','filename','fileId','ts'], ...contexts.map((c,i) => ['tpl-' + i,c[0],'I',c[1],c[2],'Synthetic.xlsx','synthetic-file-' + i,1])]);
  s.sheet('AsistenciaIngreso', [['clave','fecha','nivel','grado','seccion','nombre','marca','hora','via','ts','motivo'], ['synthetic','2026-10-03','primaria',1,'Única','Synthetic Student','P','','',1,'']]);
  s.sheet('AipPlan', [['clave','ts','json'], ['AIP_PLAN',1,JSON.stringify({test:true})]]);
  s.sheet('WhatsappGrupos', [['clave','ts','json'], ['WA_GRUPOS',1,JSON.stringify([{test:true}])]]);
  const get = params => JSON.parse(s.c.doGet({parameter: params}).text);
  return {...s, get, contexts, expected};
}

for (const action of ['loadreg', 'loadNivel', 'load']) {
  for (const method of ['GET', 'POST']) {
    const run = (s, request) => method === 'GET' ? s.get(request) : s.post(request);
    test(action + ' ' + method + ': primary limited to configured grades; absent filters never grant all', () => {
      const s = fixture();
      const res = run(s, {action, token: s.primary, ...(action === 'loadreg' ? {} : {nivel:'primaria'})});
      assert.equal(res.ok, true); assert.equal(res.total, 2);
      assert.deepEqual(res.items.map(x => Number(s.c.gradoEscritura_(x.grado))).sort(), [1,3]);
      assert.ok(res.items.every(x => x.nivel === 'primaria'));
    });
    test(action + ' ' + method + ': exact secondary area/aula relation, including unique section', () => {
      const s = fixture();
      const res = run(s, {action, token:s.secondary, nivel:'secundaria'});
      assert.equal(res.ok, true); assert.equal(res.total, 3);
      assert.ok(res.items.some(x => x.area === 'Ciencia y Tecnología' && s.c.gradoEscritura_(x.grado) === 5));
      assert.ok(!res.items.some(x => x.area === 'Matemática' && s.c.gradoEscritura_(x.grado) === 5));
      assert.ok(!res.items.some(x => x.area === 'Ciencia y Tecnología' && s.c.gradoEscritura_(x.grado) === 1));
    });
    test(action + ' ' + method + ': forged filters, body role/identity/permissions cannot widen scope', () => {
      const s = fixture();
      for (const filters of [{nivel:'primaria'}, {nivel:'secundaria',grado:5,area:'Matemática'}, {nivel:'secundaria',grado:1,seccion:'A',area:'Ciencia y Tecnología'}, {nivel:'secundaria',grado:'1|A'}, {nivel:'secundaria',seccion:'A|B'}]) {
        const res = run(s, {action, token:s.secondary, user:'admin',role:'admin',grados:[1,2,3,4,5,6],areas:['all'],asignaciones:{all:['all']}, ...filters});
        assert.equal(res.ok, true); assert.equal(res.total, 0);
      }
    });
    test(action + ' ' + method + ': admin retains complete level read', () => {
      const s = fixture();
      const res = run(s, {action, token:s.admin, nivel:'secundaria'});
      assert.equal(res.ok,true); assert.equal(res.total,6);
    });
    for (const mode of ['missing','expired','tampered','revoked','removed-teacher','wrong-role']) {
      test(action + ' ' + method + ': rejects ' + mode + ' without academic data', () => {
        const s = fixture();
        const token = mode === 'missing' ? '' : mode === 'expired' ? s.token('test-primary','docente',{exp:Date.now()-1}) : mode === 'tampered' ? s.primary+'x' : mode === 'revoked' ? s.token('test-primary','docente',{permisosVersion:999}) : mode === 'removed-teacher' ? s.token('unknown') : s.token('auxiliar','auxiliar');
        const res = run(s,{action,token,nivel:'primaria'});
        assert.equal(res.ok,false); assert.deepEqual(Object.keys(res).sort(),['error','ok']);
        assert.equal(s.state.writes,0);
      });
    }
  }
}

test('loadreg: omitted level, grade, section and area return only authorized secondary subset', () => {
  const s=fixture(); const res=s.get({action:'loadreg',token:s.secondary});
  assert.equal(res.total,3); assert.ok(res.items.every(x=>x.nivel==='secundaria'));
});
test('loadreg: nested maps/sessions cannot leak another context; metadata object stays intact', () => {
  const s=fixture(); const row=s.tables.get('RegistroNotas').rows[1]; const payload=JSON.parse(row[8]);
  const forbidden='primaria||I||2||Única||Comunicación';
  payload.sessions.push({nivel:'primaria',bim:'I',grado:2,seccion:'Única',area:'Comunicación'});
  for(const name of ['grades','finales','concArea','capsSel'])payload[name][forbidden+'||secret']= {test:'forbidden'};
  payload.asistencia['primaria||I||2||Única||secret']={test:'forbidden'};
  payload.unrecognizedAcademicBag={test:'forbidden'};
  row[8]=JSON.stringify(payload);
  const res=s.get({action:'loadreg',token:s.primary,grado:1}); const p=res.items[0].payload;
  assert.equal(p.sessions.length,1); assert.deepEqual(p.meta,payload.meta);
  for(const name of ['grades','finales','concArea','asistencia','capsSel'])assert.ok(Object.keys(p[name]).every(k=>k.includes('||1||')));
  assert.equal(p.unrecognizedAcademicBag,undefined);
  const complete=s.get({action:'loadreg',token:s.admin,grado:1,nivel:'primaria'});
  assert.deepEqual(complete.items[0].payload,payload);
});
test('reads retain explicit legacy areas+aulas and reject malformed assignments/empty permissions', () => {
  const s=fixture();
  assert.equal(s.get({action:'loadreg',token:s.token('test-legacy')}).total,1);
  assert.equal(s.get({action:'loadreg',token:s.token('test-empty')}).total,0);
  s.docentes[1].asignaciones='invalid'; s.cacheEntries.clear();
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);
  assert.equal(s.get({action:'loadreg',token:s.secondary}).ok,false);
});
test('savedoc immediately revokes teacher reads while admin read remains valid', () => {
  const s=fixture(); assert.equal(s.get({action:'loadreg',token:s.primary}).ok,true);
  assert.equal(s.post(s.body('savedoc',{token:s.admin,ts:2000})).ok,true);
  assert.equal(s.get({action:'loadreg',token:s.primary}).ok,false);
  assert.equal(s.get({action:'loadreg',token:s.admin}).ok,true);
});
test('closed bimestres remain readable within teacher scope', () => {
  const s=fixture(); s.tables.get('RegistroNotas').rows[1][2]='II';
  assert.equal(s.get({action:'loadreg',token:s.primary,bimestre:'II'}).total,1);
});

for(const [action,role] of [['loadasis','auxiliar'],['loadaip','pip'],['loadwa','auxiliar'],['classroom','admin']]) {
  for(const method of ['GET','POST']) test(action+' '+method+': only current module roles, admin and valid tokens',()=>{
    const s=fixture(); const run=p=>method==='GET'?s.get(p):s.post(p);
    for(const token of [s.admin,s.token(role,role)])assert.equal(run({action,token}).ok,true);
    for(const token of ['',s.primary,s.secondary,s.token(role,role,{exp:Date.now()-1})])assert.equal(run({action,token}).ok,false);
  });
}
test('public ping and period states contain no academic records; loaddoc stays admin POST only',()=>{
  const s=fixture();
  for(const action of ['ping','loadperiodos'])for(const response of [s.get({action}),s.post({action})]){
    assert.equal(response.ok,true); assert.equal(response.items,undefined); assert.equal(response.docentes,undefined);
  }
  assert.equal(s.get({action:'loaddoc',token:s.admin}).ok,false);
  assert.equal(s.post({action:'loaddoc',token:s.primary}).ok,false);
  assert.equal(s.post({action:'loaddoc',token:s.admin}).ok,true);
});
test('Classroom JSONP read preserved for Admin, anonymous requests never call API',()=>{
  const s=fixture(); const anon=s.get({action:'classroom',callback:'courses'});
  assert.equal(anon.ok,false); assert.equal(s.state.classroomReads,0);
  const res=s.c.doGet({parameter:{action:'classroom',token:s.admin,callback:'courses'}});
  assert.ok(res.text.startsWith('courses({')); assert.equal(s.state.classroomReads,1);
});

for(const method of ['GET','POST'])test('loadtplstatus '+method+': authorized aulas only, no Drive identifiers for teachers',()=>{
  const s=fixture(); const run=p=>method==='GET'?s.get(p):s.post(p);
  const res=run({action:'loadtplstatus',token:s.secondary});assert.equal(res.ok,true);assert.equal(res.total,5);
  assert.ok(res.items.every(x=>x.nivel==='secundaria'&&x.fileId===''));
  assert.equal(run({action:'loadtplstatus',token:s.secondary,nivel:'primaria'}).total,0);
  for(const token of ['',s.token('test-secondary','docente',{exp:Date.now()-1}),s.secondary+'x'])assert.equal(run({action:'loadtplstatus',token}).ok,false);
  assert.equal(run({action:'loadtplstatus',token:s.admin}).items.filter(x=>x.fileId).length,9);
  assert.equal(s.state.driveReads,0);
});

for(const method of ['GET','POST'])test('loadtpl '+method+': complete workbook Admin only; teacher and invalid tokens never read Drive',()=>{
  const s=fixture();const run=p=>method==='GET'?s.get(p):s.post(p);
  const request={action:'loadtpl',nivel:'primaria',bimestre:'I',grado:1,seccion:'Única'};
  for(const token of ['',s.primary,s.secondary,s.token('pip','pip'),s.token('admin','admin',{exp:Date.now()-1}),s.admin+'x']){
    assert.equal(run({...request,token,role:'admin',user:'admin'}).ok,false);assert.equal(s.state.driveReads,0);
  }
  const res=run({...request,token:s.admin});assert.equal(res.ok,true);assert.equal(res.found,true);
  assert.ok(res.b64);assert.equal(s.state.driveReads,1);
});

function clientFunction(file, name) {
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const m=new RegExp('^( *)(?:async )?function '+name+'\\([^)]*\\)\\s*\\{','m').exec(html);
  assert.ok(m,name);const end=html.indexOf('\n'+m[1]+'}',m.index);assert.ok(end>m.index);
  return html.slice(m.index,end+m[1].length+2);
}
for(const [file,name,helper,role,action] of [
  ['admin.html','listarPlantillasSiagie','tokenSesionAdmin','admin','loadtplstatus'],
  ['admin.html','bajarGruposWa','tokenSesionAdmin','admin','loadwa'],
  ['admin.html','fetchRegAula','tokenSesionAdmin','admin','loadreg'],
  ['admin.html','renderAulasSiagie','tokenSesionAdmin','admin','loadtplstatus'],
  ['admin.html','vaciarSiagieOficial','tokenSesionAdmin','admin','loadtpl'],
  ['registro.html','bajarRegistroNube',null,'docente','loadreg'],
  ['registro.html','consultarEstadoSiagie',null,'docente','loadtplstatus'],
  ['registro.html','rellenarSiagieExcel',null,'admin','loadtpl'],
  ['primaria.html','bajarNube',null,'docente','loadNivel'],
  ['secundaria.html','bajarNube',null,'docente','loadNivel'],
  ['auxiliar.html','bajarNube','tokenSesionAuxiliar','auxiliar','loadasis'],
  ['auxiliar.html','bajarGruposWa','tokenSesionAuxiliar','auxiliar','loadwa'],
  ['aula_innovacion.html','bajarAipNube','tokenSesionAip','pip','loadaip']
])test(file+': '+name+' sends token via POST and consumes the protected response',async()=>{
  const s=fixture();const secondary=file==='secundaria.html';
  const token=role==='docente'?(secondary?s.secondary:s.primary):s.token(role,role);
  const level=secondary?'secundaria':'primaria';const requests=[],responses=[];
  const storage={getItem:()=>JSON.stringify({token}),setItem(){}};
  const context=vm.createContext({
    sessionStorage:storage,localStorage:storage,window:{__IE_SES:{token}},getLoginSession:()=>({token,role}),
    URLSearchParams,Blob,URL:{createObjectURL:()=> 'synthetic-blob'},atob:value=>Buffer.from(value,'base64').toString('binary'),
    CLOUD_API_URL:'synthetic-backend',CLOUD_NIVEL:level,nivel:level,areaActual:'Comunicación',
    fetch:async(url,options)=>{assert.equal(url,'synthetic-backend');assert.equal(options.method,'POST');const body=JSON.parse(options.body);requests.push(body);const response=s.post(body);responses.push(response);return {text:async()=>JSON.stringify(response),json:async()=>response};},
    document:{getElementById:id=>({value:/Nivel/.test(id)?level:/Bim/.test(id)?'I':id==='inpFecha'?'2026-10-03':'1',classList:{add(){},remove(){}},scrollIntoView(){}}),createElement:()=>({click(){}})},
    ctxBase:()=>({nivel:level,bim:'I',grado:1,seccion:'Única',area:'Comunicación'}),
    ctxTpl:()=>({nivel:level,bim:'I',grado:1,seccion:'Única'}),
    estado:{datos:{},areaActual:'',docentes:{}},storageDisponible:false,store:{sessions:[]},sesionActiva:null,
    toast(){},mostrarToast(){},alert(){},confirm:()=>true,saveStore(){},mergeRegistroPayload:()=>1,renderSesiones(){},renderStudents(){},
    aplicarTotalesDesdeNube:()=>({}),aplicarDocentesDesdeNube:()=>({}),syncInputTotalEstudiantes(){},syncInputDocente(){},
    renderizarAreas(){},renderizarResumen(){},renderizarNavegadorAreas(){},
    loadAsis:()=>({}),saveAsis(){},renderLista(){},hoyISO:()=> '2026-10-03',WA_KEY:'synthetic-wa',saveGruposWaLocal(){},renderWaAulas(){},
    aplicarPaqueteAip(){},aulasDelNivel:()=>[],informeSiagie:()=>({ok:true}),siagieTplMeta:null,
    IEStudents:{loadRoster:async()=>({primaria:{estudiantes:[]},secundaria:{estudiantes:[]}})},
    XLSX:{read:()=>({SheetNames:[]}),write:()=>new Uint8Array()},fetchRegAula:async()=>[],areasDeNivel:()=>[],estudiantesDe:()=>[]
  });
  if(helper)new vm.Script(clientFunction(file,helper)).runInContext(context);
  new vm.Script(clientFunction(file,'fetchLecturaNube')).runInContext(context);
  new vm.Script(clientFunction(file,name)).runInContext(context);
  await context[name]({nivel:level,bim:'I',grado:1,seccion:'Única'});
  assert.equal(requests.length,1);assert.equal(requests[0].token,token);assert.equal(requests[0].action,action);
  assert.equal(responses[0].ok,true);
});

test('template status informs teachers of Admin-only workbook export without enabling download',async()=>{
  const s=fixture();const button={},label={};const context=vm.createContext({
    CLOUD_API_URL:'synthetic',getLoginSession:()=>({role:'docente',token:s.primary}),URLSearchParams,
    document:{getElementById:id=>id==='btnSiagieProc'?button:label},
    ctxBase:()=>({nivel:'primaria',bim:'I',grado:1,seccion:'Única'}),
    fetch:async(url,options)=>({text:async()=>JSON.stringify(s.post(JSON.parse(options.body)))})
  });
  new vm.Script(clientFunction('registro.html','fetchLecturaNube')).runInContext(context);
  new vm.Script(clientFunction('registro.html','consultarEstadoSiagie')).runInContext(context);
  await context.consultarEstadoSiagie();
  assert.equal(button.disabled,true);assert.match(button.textContent,/solo Admin/);assert.match(label.textContent,/Plantilla disponible/);
});
test('teacher scope uses current server config, not stale signed level or supplied permission lists',()=>{
  const s=fixture();const token=s.token('test-primary','docente',{nivel:'secundaria',grados:[2,4,5]});
  assert.equal(s.get({action:'loadreg',token,nivel:'secundaria'}).total,0);
  assert.equal(s.get({action:'loadreg',token,nivel:'primaria'}).total,2);
  s.docentes[0].grados=[3];s.cacheEntries.clear();s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);
  assert.equal(s.get({action:'loadreg',token,nivel:'primaria'}).total,1);
});
