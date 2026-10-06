const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const studentsFixture=new Function('require','__dirname',read('tests/backend-students.test.cjs').split('\ntest(')[0]+'\nreturn studentsFixture;')(require,__dirname);
const {frontend,extract:matrixExtract}=new Function('require','__dirname',read('tests/matrix-consistency.test.cjs').split('\ntest(')[0]+'\nreturn {frontend,extract};')(require,__dirname);
const {fixture:client,extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('\ntest(')[0]+'\nreturn {fixture,extract};')(require,__dirname);
const adminFixture=new Function('read','vm','assert','inline',read('tests/legacy-cleanup.test.cjs').slice(read('tests/legacy-cleanup.test.cjs').indexOf('function admin('),read('tests/legacy-cleanup.test.cjs').indexOf("test('Admin session"))+'\nreturn admin;')(read,vm,assert,html=>[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]));
function backend() {
  const s=studentsFixture();
  const docentes=[{user:'test-primary',nombre:'Synthetic Classroom',pass:'synthetic-only',nivel:'primaria',grados:[6],areas:['Comunicación','Matemática'],asignaciones:{'Comunicación':['6|ÚNICA'],'Matemática':['6|ÚNICA']}},
    {user:'synthetic-ef',nombre:'Synthetic Specialist',pass:'synthetic-only',nivel:'primaria',grados:[1,2,3,4,5,6],areas:['Educación Física'],asignaciones:{'Educación Física':[1,2,3,4,5,6].map(g=>g+'|ÚNICA')}},
    {user:'synthetic-legacy',nombre:'Synthetic Legacy',pass:'synthetic-only',nivel:'primaria',grados:[6]},...s.docentes.slice(1)];
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(docentes);s.cacheEntries.clear();s.docentes=docentes;
  const req=(action,user,grado,area,extra={})=>s.post(s.body(action,{token:s.token(user),grado,seccion:'Única',area,...extra}));
  const login=user=>s.c.responderLogin_({tipo:'docente',usuario:user,password:'synthetic-only'});
  return {...s,req,login};
}
for(const action of ['savereg','saveArea']) {
  test(action+': classroom teacher can write Communication at 6, but never Physical Education',()=>{
    const s=backend();assert.equal(s.req(action,'test-primary',6,'Comunicación').ok,true);
    const before=s.state.writes;assert.equal(s.req(action,'test-primary',6,'Educación Física').ok,false);assert.equal(s.state.writes,before);
    assert.equal(s.req(action,'test-primary',6,'Comunicación',{seccion:'A'}).ok,false);
  });
  test(action+': EF specialist can write EF in grades 1–6, not other areas or an unassigned grade',()=>{
    const s=backend();for(const g of [1,2,3,4,5,6])assert.equal(s.req(action,'synthetic-ef',g,'Educación Física').ok,true);
    for(const area of ['Comunicación','Matemática','Personal Social'])assert.equal(s.req(action,'synthetic-ef',6,area).ok,false);
    s.docentes[1].grados=[1,2,3,4,5];s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
    assert.equal(s.req(action,'synthetic-ef',6,'Educación Física').ok,false);
  });
}
for(const action of ['loadreg','loadnivel','load'])for(const method of ['GET','POST'])test(action+' '+method+': reads require exact area/aula; Admin retains total view',()=>{
  const s=backend();
  for(const g of [1,2,3,4,5,6])for(const area of ['Comunicación','Educación Física']) {
    for(const write of ['savereg','saveArea'])assert.equal(s.req(write,'admin',g,area,{token:s.admin}).ok,true);
  }
  const load=(user,extra={})=>method==='POST'?s.post({action,nivel:'primaria',token:s.token(user,user==='admin'?'admin':'docente'),...extra}):s.get({action,nivel:'primaria',token:s.token(user,user==='admin'?'admin':'docente'),...extra});
  const titular=load('test-primary');assert.equal(titular.ok,true);assert.equal(titular.items.length,1);assert.equal(titular.items[0].area,'Comunicación');assert.equal(s.c.gradoEscritura_(titular.items[0].grado),6);
  const specialist=load('synthetic-ef');assert.equal(specialist.items.length,6);assert.ok(specialist.items.every(a=>a.area==='Educación Física'));
  assert.equal(load('synthetic-ef',{area:'Comunicación',role:'admin'}).items.length,0);assert.equal(load('test-primary',{area:'Educación Física'}).items.length,0);assert.equal(load('admin').items.length,12);
});
test('legacy absent and empty primary maps grant regular areas only, never implicit EF',()=>{
  const s=backend();for(const map of [undefined,{}]) {
    s.docentes[2].asignaciones=map;s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
    const login=s.login('synthetic-legacy');assert.equal(login.ok,true);assert.equal(login.areas.includes('Educación Física'),false);assert.equal(login.asignaciones['Comunicación'][0],'6|ÚNICA');
    assert.equal(s.req('savereg','synthetic-legacy',6,'Comunicación').ok,true);assert.equal(s.req('savereg','synthetic-legacy',6,'Educación Física').ok,false);
  }
});
test('login exposes effective primary grades/areas/aulas/map, and preserves signed 12-hour model',()=>{
  const s=backend(),login=s.login('synthetic-ef');assert.deepEqual(clone(login.grados),[1,2,3,4,5,6]);assert.deepEqual(clone(login.areas),['Educación Física']);assert.deepEqual(clone(login.asignaciones),{'Educación Física':[1,2,3,4,5,6].map(g=>g+'|ÚNICA')});assert.equal(login.tokenExp-JSON.parse(Buffer.from(login.token.split('.')[0],'base64url')).iat,12*60*60*1000);
  const before=s.docentes[1];before.grados=[1];before.asignaciones={'Educación Física':['1|ÚNICA','6|ÚNICA','1|A']};s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
  assert.deepEqual(clone(s.login('synthetic-ef').asignaciones),{'Educación Física':['1|ÚNICA']});
});
test('assignment update revokes previous sessions for reads, writes and students bridge without touching historical notes',()=>{
  const s=backend(),login=s.login('test-primary');
  assert.equal(s.req('savereg','admin',6,'Educación Física',{token:s.admin}).ok,true);
  const history=JSON.stringify(s.tables.get('RegistroNotas').rows);s.docentes[0].asignaciones={'Matemática':['6|ÚNICA']};
  assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docentes}).ok,true);
  assert.equal(s.post({action:'loadreg',token:login.token}).ok,false);assert.equal(s.req('savereg','test-primary',6,'Comunicación',{token:login.token}).ok,false);assert.equal(s.c.studentsBridgeCargar({token:login.token}).ok,false);
  assert.equal(JSON.stringify(s.tables.get('RegistroNotas').rows),history);assert.notEqual(s.login('test-primary').permisosVersion,login.permisosVersion);
});
test('primary students access requires at least one effective area at that exact aula',()=>{
  const s=backend();s.docentes[1].grados=[1];s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
  const response=s.c.studentsBridgeCargar({token:s.token('synthetic-ef')});assert.equal(response.ok,true);assert.deepEqual(clone(response.estudiantes.map(a=>a.grado)),[1]);
});
test('sanitized matrix model resolves different official teachers per primary area, including sessions of each teacher',async()=>{
  const s=backend();for(const [role,user] of [['admin','admin'],['docente','test-primary'],['docente','synthetic-ef']]) {
    const f=frontend(s,role,user);await f.c.IEMatrixTeachers.load('synthetic-api');
    f.run("let estado={grado:'SEXTO',seccion:'UNICA',areaActual:'Comunicación'};");f.run(matrixExtract('primaria.html','getNombreDocente'));f.run(matrixExtract('primaria.html','syncInputDocente'));
    if(user!=='synthetic-ef')assert.equal(f.c.getNombreDocente(),'Synthetic Classroom');
    f.run("estado.areaActual='Educación Física'");f.c.syncInputDocente();assert.equal(f.c.getNombreDocente(),user==='test-primary'?'':'Synthetic Specialist');assert.equal(f.node('nombreDocente').readOnly,true);
    assert.equal(f.c.IEMatrixTeachers.nombre('primaria','SEXTO','A','Educación Física'),'');
    assert.doesNotMatch(JSON.stringify(f.c.IEMatrixTeachers.peek()),/synthetic-only|"pass"/);
  }
});
test('Registro primary filters areas and grades for classroom/specialist/legacy/Admin',()=>{
  const s=backend(),f=client();f.run("let nivel='primaria';const EST_PRIM={'Comunicación':{},'Matemática':{},'Educación Física':{}},EST_SEC={};let ses;function getLoginSession(){return ses;}");
  for(const name of ['estructura','aulaKey','areasPermitidas','areas','gradosPermitidos'])f.run(extract('registro.html',name));
  f.c.document.getElementById('selGrado').value='6';f.c.document.getElementById('selSeccion').value='Única';
  for(const [user,expected] of [['test-primary',['Comunicación','Matemática']],['synthetic-ef',['Educación Física']]]) {
    f.c.login=s.login(user);f.run('ses=login');assert.deepEqual(clone(f.c.areas()),expected);
  }
  f.c.login=s.login('test-primary');f.run('ses=login');f.c.document.getElementById('selGrado').value='5';assert.deepEqual(clone(f.c.areas()),[]);assert.deepEqual(clone(f.c.gradosPermitidos()),[6]);
  f.run("ses={role:'docente',nivel:'primaria',grados:[6]}");f.c.document.getElementById('selGrado').value='6';assert.deepEqual(clone(f.c.areas()),['Comunicación','Matemática']);
  f.run("ses={role:'admin'}");assert.deepEqual(clone(f.c.areas()),['Comunicación','Matemática','Educación Física']);
});
test('primary matrix guard filters exact area/grade, including legacy EF denial',()=>{
  const s=backend(),f=client();
  const source=read('primaria.html'),begin=source.indexOf('window.__IE_areasOK ='),end=source.indexOf('</script>',begin);
  f.run("let estado={grado:'SEXTO',seccion:'UNICA'};");f.run(source.slice(begin,end));
  f.c.window.__IE_SES=s.login('test-primary');assert.equal(f.c.window.__IE_areasOK('Comunicación'),true);assert.equal(f.c.window.__IE_areasOK('Educación Física'),false);
  f.c.window.__IE_SES=s.login('synthetic-ef');assert.equal(f.c.window.__IE_areasOK('Educación Física'),true);assert.equal(f.c.window.__IE_areasOK('Comunicación'),false);
  f.c.window.__IE_SES={role:'docente',grados:[1],asignaciones:{'Educación Física':['1|ÚNICA']}};assert.equal(f.c.window.__IE_areasOK('Educación Física'),false);
  f.c.window.__IE_SES={role:'docente',grados:[6]};assert.equal(f.c.window.__IE_areasOK('Educación Física'),false);
});
test('Secundaria exact assignments and legacy behavior remain unchanged',()=>{
  const s=backend();assert.equal(s.req('savereg','test-secondary',1,'Matemática',{nivel:'secundaria',seccion:'A'}).ok,true);assert.equal(s.req('savereg','test-secondary',5,'Matemática',{nivel:'secundaria'}).ok,false);assert.equal(s.req('savereg','test-secondary',5,'Ciencia y Tecnología',{nivel:'secundaria'}).ok,true);assert.equal(s.req('savereg','test-legacy',2,'Matemática',{nivel:'secundaria',seccion:'B'}).ok,true);
});
test('Admin primary form offers all curricular areas and saves EF mapped individually to selected grades',()=>{
  const f=adminFixture({role:'admin',user:'admin'}),c=f.context;
  const grados=[1,2,3,4,5,6].map(g=>({value:String(g),checked:true}));
  const areas=[{value:'Educación Física',checked:true}],original=c.document.querySelectorAll;
  c.document.querySelectorAll=selector=>selector.startsWith('.doc-grado')?grados:selector.startsWith('.doc-area')?areas:selector==='#docAsignacionesBox [data-area-asig]'?[{getAttribute:()=> 'Educación Física',querySelectorAll:()=>grados.map(g=>({value:g.value+'|ÚNICA'}))}]:original(selector);
  c.showTab('docentes');assert.match(f.elements.get('docAreasBox').innerHTML,/Educación Física/);assert.match(f.elements.get('docAreasBox').innerHTML,/Personal Social/);assert.doesNotMatch(f.elements.get('docAreasBox').innerHTML,/Inglés/);
  assert.match(f.elements.get('docAsignacionesBox').innerHTML,/6\|ÚNICA/);
  f.elements.get('docUser').value='synthetic-specialist';f.elements.get('docPass').value='synthetic-only';f.elements.get('docNombre').value='Synthetic Specialist';c.guardarDocente();
  const doc=clone(c.loadDocentes()[0]);assert.deepEqual(doc.grados,[1,2,3,4,5,6]);assert.deepEqual(doc.areas,['Educación Física']);assert.deepEqual(doc.asignaciones,{'Educación Física':[1,2,3,4,5,6].map(g=>g+'|ÚNICA')});assert.match(f.elements.get('docLista').innerHTML,/Educación Física →/);
});
test('Admin editing a legacy primary teacher prepares regular area assignments without selecting EF',()=>{
  const f=adminFixture({role:'admin',user:'admin'}),c=f.context;
  c.window.scrollTo=()=>{};
  c.saveDocentes([{id:'synthetic-id',user:'synthetic-legacy',pass:'synthetic-only',nombre:'Synthetic Legacy',nivel:'primaria',grados:[6],asignaciones:{}}]);
  const grades=[{value:'6',checked:false}],areas=['Comunicación','Matemática','Educación Física'].map(value=>({value,checked:false})),original=c.document.querySelectorAll;
  c.document.querySelectorAll=selector=>selector==='.doc-grado'?grades:selector==='.doc-grado:checked'?grades.filter(g=>g.checked):selector==='.doc-area'?areas:selector==='.doc-area:checked'?areas.filter(a=>a.checked):selector==='#docAsignacionesBox [data-area-asig]'?areas.filter(a=>a.checked).map(a=>({getAttribute:()=>a.value,querySelectorAll:()=>[{value:'6|ÚNICA'}]})):original(selector);
  c.editarDocente('synthetic-id');assert.equal(areas.find(a=>a.value==='Educación Física').checked,false);assert.ok(areas.find(a=>a.value==='Comunicación').checked);assert.match(f.elements.get('docAsignacionesBox').innerHTML,/6\|ÚNICA/);
});
test('explicit primary assignments never fall back to unlisted regular areas and malformed maps deny access',()=>{
  const s=backend();assert.equal(s.req('savereg','test-primary',6,'Personal Social').ok,false);
  for(const map of [[], 'invalid', {'Comunicación':[]}, {'Comunicación':['6|A']}]) {
    s.docentes[0].asignaciones=map;s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
    assert.equal(s.req('savereg','test-primary',6,'Comunicación').ok,false);assert.equal(s.post({action:'loadreg',token:s.primary}).ok,map && typeof map==='object'&&!Array.isArray(map));
  }
});
test('EF specialist with no selected area can upload authorized progress with its own confirmed official teacher',async()=>{
  const s=backend(),f=frontend(s,'docente','synthetic-ef'),payloads=[],messages=[];
  await f.c.IEMatrixTeachers.load('synthetic-api');
  f.run(`let estado={grado:'SEXTO',seccion:'UNICA',bimestre:'I',areaActual:null,datos:{'I|SEXTO|UNICA':{'Educación Física':{'C1':{inicio:1}},'Comunicación':{'C1':{inicio:1}}}}};
    const ESTRUCTURA_AREAS={'Educación Física':{competencias:['C1']},'Comunicación':{competencias:['C1']}};const storageDisponible=false;function getTotalEstudiantes(){return 1;}function cloudClave(area){return 'primaria|I|SEXTO|UNICA|'+area;}`);
  f.c.window.__IE_SES=s.login('synthetic-ef');f.c.window.__IE_areasOK=area=>area==='Educación Física';f.c.impedirEdicionPeriodo=()=>false;f.c.mostrarToast=message=>messages.push(message);f.c.CLOUD_API_URL='synthetic-api';f.c.CLOUD_NIVEL='primaria';
  f.node('modalSubirNube').remove=()=>{};let modal;
  f.c.document.createElement=()=>({addEventListener(){}});f.c.document.body={appendChild:node=>{modal=node;}};
  f.c.fetch=async(url,options)=>{const body=JSON.parse(options.body);payloads.push(body);return {text:async()=>JSON.stringify(s.post(body))};};
  for(const name of ['getNombreDocente','getDato','areasConDatosDelGrado','nombreDocenteParaSubir','enviarAreaANube','ejecutarSubidaAreas','cerrarModalSubirNube','subirNube'])f.run(matrixExtract('primaria.html',name));
  assert.equal(f.c.getNombreDocente(),'Synthetic Specialist');
  f.c.subirNube();assert.ok(modal);assert.doesNotMatch(modal.innerHTML,/Comunicación/);assert.equal(messages.length,0);
  await f.c.ejecutarSubidaAreas(f.c.areasConDatosDelGrado());assert.equal(payloads.length,1);assert.equal(payloads[0].area,'Educación Física');assert.equal(payloads[0].docente,'Synthetic Specialist');
});
for(const [user,area] of [['test-primary','Comunicación'],['synthetic-ef','Educación Física']])test('export for '+user+' excludes other areas/grades in historical local state without mutating it',()=>{
  const s=backend(),f=client(),source=read('primaria.html'),begin=source.indexOf('window.__IE_areasOK ='),end=source.indexOf('</script>',begin);
  f.c.window.__IE_SES=s.login(user);
  f.run(`let estado={grado:'SEXTO',seccion:'UNICA',bimestre:'I',datos:{'I|SEXTO|UNICA':{'Comunicación':{C1:'synthetic-classroom'},'Educación Física':{C1:'synthetic-ef'}},'I|SEGUNDO|UNICA':{'Comunicación':{C1:'other-grade'}}},docentesPorAula:{'I|SEGUNDO|UNICA':'Other teacher'},totalesPorAula:{'I|SEXTO|UNICA':20,'I|SEGUNDO|UNICA':10}};
    const ESTRUCTURA_AREAS={'Comunicación':{},'Educación Física':{}};function getTotalEstudiantes(){return 20;}function getNombreDocente(){return 'Synthetic';}`);
  f.run(source.slice(begin,end));f.run(matrixExtract('primaria.html','estadoParaExportar'));
  const before=f.run('JSON.stringify(estado)'),out=clone(f.c.estadoParaExportar());
  assert.deepEqual(Object.keys(out.datos['I|SEXTO|UNICA']),[area]);assert.equal(out.datos['I|SEGUNDO|UNICA'],undefined);
  assert.deepEqual(out.docentesPorAula,{});assert.equal(f.run('JSON.stringify(estado)'),before);
  f.c.window.__IE_SES={role:'admin'};assert.equal(JSON.stringify(f.c.estadoParaExportar()),before);
  assert.match(matrixExtract('primaria.html','exportarDatos'),/JSON.stringify\(estadoParaExportar\(\)/);
});
