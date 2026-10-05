const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function extract(file,name){
 const s=read(file),start=s.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);
 const line=s.slice(start).split('\n')[0];if(line.trimEnd().endsWith('}'))return line;
 const indent=s.slice(s.lastIndexOf('\n',start-1)+1,start),end=s.indexOf('\n'+indent+'}',start)+indent.length+2;
 return s.slice(start,end);
}
function fixture(){
 const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:id==='selBim'?'III':id==='selGrado'?'4':id==='selSeccion'?'B':'2026-10-03'});return els.get(id);};
 const requests=[],alerts=[];const roster=(al,bim='III',extra={})=>({primaria:{estudiantes:[]},secundaria:{estudiantes:al},bimestre:bim,padronInicializado:true,...extra});
 const main={inert:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelectorAll:()=>[]};
 const c=vm.createContext({setTimeout:()=>0,clearTimeout(){},window:{},document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>s==='main'?main:null},console,alert:v=>alerts.push(v),toast(){},saveStore(){},renderStudents(){},getLoginSession:()=>({role:'docente'}),bimestreHabilitado:()=>true,
   IEStudents:{validToken:()=> 'synthetic-token',empty:()=>roster([]),peekRoster:()=>c.base || null,loadRoster:async bim=>{requests.push(bim);return roster(c.next,bim);}}});
 new vm.Script(read('student-identity.js')).runInContext(c);c.studentKey=c.window.studentKey;c.IEStudentIdentity=c.window.IEStudentIdentity;
 const run=s=>new vm.Script(s).runInContext(c);
 run(`let nivel='secundaria',areaActual='Matemática',store={sessions:[],grades:{},finales:{},concArea:{},meta:{},studentAliases:{}},notas={},sesionActiva={comp:'Resuelve',capacidad:'Capacidad',fecha:'2026-10-03'},padronVerificadoServidor=true,tokenPadron='synthetic-token',vencimientoCachePadron,cargandoEstudiantes=false,padronBimestre='III',solicitudPadron=0,bdEstudiantes=IEStudents.empty();
   function ctxBase(){return {nivel,bim:document.getElementById('selBim').value,grado:4,seccion:'B',area:areaActual};}
   function estudiantes(){return bdEstudiantes.secundaria.estudiantes;}
   function cloudClaveReg(){const c=ctxBase();return [c.nivel,c.bim,c.grado,c.seccion,c.area].join('||');}`);
 for(const name of ['alumnoIdentidad','identidadAlumno','aliasesAula','recordarPadron','leerNota','metaRegistro','registroSoloLectura','registroNubeNoVerificada','sincronizarEdicionRegistro','estadoPadron','vigilarCachePadron','bloquearRegistroMientrasValida','pintarPadronInmediato','cargarPadronRegistro','cambiarBimestreRegistro','gradeKey','finalKey','concAreaKey','asisCtxKey','asisGet','mergeFechasAsistencia','sliceRegistroArea','mergeRegistroPayload','bimCerradoDocente'])run(extract('registro.html',name));
 run("function prefijoReg(){return cloudClaveReg()+'||';}function tsDe(x){return x&&x.ts||0;}let savedBim='';function guardarTodo(){savedBim=ctxBase().bim;}function llenarAulasPadron(){}function onContexto(){}");
 return {c,run,roster,requests,alerts,el,main};
}
test('studentKey prefers SIAGIE ID, then student code, then normalized name',()=>{
 const {c}=fixture();assert.equal(c.studentKey({idSiagie:'42',codigoEstudiante:'C',nombre:'Name'}),'id:42');
 assert.equal(c.studentKey({codigoEstudiante:'C',nombre:'Name'}),'cod:C');assert.equal(c.studentKey({nombre:' Álvarez,   Ana '}),'nom:ALVAREZ%20ANA');
});
test('Registro selection III loads the quarterly roster, not BASE_ACTUAL; change saves old context first',async()=>{
 const s=fixture();s.c.next=[{idSiagie:'new',nombre:'Synthetic New'}];s.run("padronBimestre='II'");
 await s.c.cambiarBimestreRegistro();assert.deepEqual(s.requests,['III']);assert.equal(s.run('savedBim'),'II');
 assert.equal(s.run('bdEstudiantes.bimestre'),'III');assert.equal(s.run('estudiantes().length'),1);
});
test('Registro renders same-session cached roster immediately but permits local work but guards cloud writing until server verification',async()=>{
 const s=fixture(),cached=s.roster([{idSiagie:'cached',nombre:'Synthetic Cached'}]);
 let resolveServer;s.c.IEStudents.peekRoster=b=>b==='III'?cached:null;
 s.c.IEStudents.loadRoster=b=>{s.requests.push(b);return new Promise(r=>{resolveServer=r;});};
 const pending=s.c.cargarPadronRegistro('III');
 assert.equal(s.run('estudiantes()[0].idSiagie'),'cached');assert.equal(s.main.inert,false);assert.equal(s.c.registroSoloLectura(),false);assert.equal(s.c.registroNubeNoVerificada(),true);
 resolveServer(s.roster([{idSiagie:'fresh',nombre:'Synthetic Fresh'}]));
 await pending;assert.equal(s.run('estudiantes()[0].idSiagie'),'fresh');assert.equal(s.main.inert,false);
});
test('Same ID keeps notes after rename/order change; new is empty, removed is hidden and all history survives',async()=>{
 const s=fixture(),continuing={idSiagie:'42',nombre:'Synthetic Before',grado:4,seccion:'B',orden:1},removed={idSiagie:'43',nombre:'Synthetic Removed',grado:4,seccion:'B'};
 s.c.base=s.roster([continuing,removed]);s.run('bdEstudiantes=base;recordarPadron(base)');
 s.run("store.finales[finalKey('Resuelve','id:42')]={nota20:17,ts:1};store.finales[finalKey('Resuelve','id:43')]={nota20:15,ts:1}");
 const before=s.run('JSON.stringify(store.finales)');
 s.c.next=[{...continuing,nombre:'Synthetic After',orden:9},{idSiagie:'44',nombre:'Synthetic New',grado:4,seccion:'B'}];
 await s.c.cargarPadronRegistro('III');
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),17);
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:44'))"),undefined);
 assert.equal(s.run("estudiantes().some(a=>a.idSiagie==='43')"),false);assert.equal(s.run('JSON.stringify(store.finales)'),before);
});
test('Historical name keys remain readable; aliases persist in object meta and survive cloud round-trip',async()=>{
 const s=fixture(),al={idSiagie:'42',nombre:'Synthetic Before',grado:4,seccion:'B'};s.c.base=s.roster([al]);s.run('bdEstudiantes=base;recordarPadron(base)');
 s.run("store.finales[cloudClaveReg()+'||Resuelve||Synthetic Before']={nota20:16};store.meta[cloudClaveReg()]='Synthetic Teacher'");
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),16);
 s.c.next=[{...al,nombre:'Synthetic Corrected'}];await s.c.cargarPadronRegistro('III');
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),16);
 const payload=s.c.sliceRegistroArea();assert.equal(typeof payload.meta,'object');assert.equal(payload.meta.docente,'Synthetic Teacher');
 assert.ok(Object.hasOwn(payload.finales,'secundaria||III||4||B||Matemática||Resuelve||Synthetic Before'));
 s.c.payload=JSON.parse(JSON.stringify(payload));s.run('store={sessions:[],grades:{},finales:{},concArea:{},meta:{},studentAliases:{}};mergeRegistroPayload(payload)');
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),16);
});
test('Stable keys take precedence; clearing a note does not resurrect its legacy name key',()=>{
 const s=fixture();s.c.base=s.roster([{idSiagie:'42',nombre:'Synthetic Student'}]);s.run('bdEstudiantes=base');
 s.run("store.finales[cloudClaveReg()+'||Resuelve||Synthetic Student']={nota20:12};store.finales[finalKey('Resuelve','id:42')]={nota20:18}");
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),18);
 s.run("store.finales[finalKey('Resuelve','id:42')]={borrado:true,ts:2}");assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42'))"),undefined);
});
test('Legacy names cannot be assigned arbitrarily to two students with the same name',()=>{
 const s=fixture();s.c.base=s.roster([{idSiagie:'1',nombre:'Synthetic Same'},{idSiagie:'2',nombre:'Synthetic Same'}]);s.run('bdEstudiantes=base');
 s.run("store.finales[cloudClaveReg()+'||Resuelve||Synthetic Same']={nota20:19}");assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:1'))"),undefined);
});

test('A new ID does not inherit a removed student legacy note merely by sharing its name',async()=>{
 const s=fixture(),old={idSiagie:'old',nombre:'Synthetic Same',grado:4,seccion:'B'};
 s.c.base=s.roster([old]);s.run('bdEstudiantes=base;recordarPadron(base)');
 s.run("store.finales[cloudClaveReg()+'||Resuelve||Synthetic Same']={nota20:19}");
 s.c.next=[{...old,idSiagie:'new'}];await s.c.cargarPadronRegistro('III');
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:new'))"),undefined);
 assert.equal(s.run("store.finales[cloudClaveReg()+'||Resuelve||Synthetic Same'].nota20"),19);
});

test('Adding SIAGIE ID preserves notes previously saved under the same student code',()=>{
 const s=fixture();s.c.base=s.roster([{idSiagie:'42',codigoEstudiante:'00042',nombre:'Synthetic New Name'}]);s.run('bdEstudiantes=base');
 s.run("store.finales[cloudClaveReg()+'||Resuelve||cod:00042']={nota20:18}");
 assert.equal(s.run("leerNota(store.finales,finalKey('Resuelve','id:42')).nota20"),18);
});
test('Roster fetch failure clears active list; loading cannot write into the previous roster',async()=>{
 const s=fixture();s.c.base=s.roster([{idSiagie:'42',nombre:'Synthetic Previous'}]);s.run('bdEstudiantes=base');
 s.c.IEStudents.loadRoster=async()=>{assert.equal(s.c.bimCerradoDocente(),true);throw Error('Synthetic denied');};
 assert.equal(await s.c.cargarPadronRegistro('IV'),false);assert.equal(s.run('estudiantes().length'),0);assert.equal(s.c.bimCerradoDocente(),true);
});
test('Admin export reads both stable and historical note keys using the same identity helper',()=>{
 const s=fixture();for(const name of ['letraDesdePayload','concDesdePayload'])s.run(extract('admin.html',name));
 s.run("function numToLetterAdm(n){return n>=17?'AD':'A'}function promedioAdm(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}");
 const ctx={nivel:'secundaria',bim:'III',grado:4,seccion:'B'},al={idSiagie:'42',nombre:'Synthetic Student'};
 const p={finales:{'secundaria||III||4||B||Matemática||Resuelve||id:42':{nivel:'AD'}},concArea:{'secundaria||III||4||B||Matemática||Synthetic Student':{texto:'Synthetic Conclusion'}}};
 assert.equal(s.c.letraDesdePayload(p,ctx,'Matemática','Resuelve',al),'AD');assert.equal(s.c.concDesdePayload(p,ctx,'Matemática',al),'Synthetic Conclusion');
});

test('Real grade collection writes a stable key while retaining the historical name key',()=>{
 const s=fixture();s.c.base=s.roster([{idSiagie:'42',nombre:'Synthetic Student'}]);s.run('bdEstudiantes=base');
 s.run("store.grades[cloudClaveReg()+'||Resuelve||Capacidad||2026-10-03||Synthetic Student']={nota20:12}");
 s.c.document.querySelectorAll=selector=>selector==='.cal-nota'?[{value:'18',readOnly:false,dataset:{nom:'id%3A42',cap:'Capacidad',comp:'Resuelve'}}]:[];
 s.run('function upsertSesionCap(){}');s.run(extract('registro.html','capKeyHoy'));s.run(extract('registro.html','recolectarPantalla'));s.run('function numToLetter(n){return n>=17?\'AD\':\'A\'}');
 s.c.recolectarPantalla();assert.equal(s.run("store.grades[cloudClaveReg()+'||Resuelve||Capacidad||2026-10-03||id:42'].nota20"),18);
 assert.equal(s.run("store.grades[cloudClaveReg()+'||Resuelve||Capacidad||2026-10-03||Synthetic Student'].nota20"),12);
});

for(const file of ['admin.html','registro.html'])test(file+': real SIAGIE export prefers ID, then code, then name',async()=>{
 const s=fixture(),students=[{idSiagie:'42',codigoEstudiante:'00042',nombre:'Synthetic Corrected',grado:4,seccion:'B'},{idSiagie:'99',codigoEstudiante:'00099',nombre:'Synthetic Other',grado:4,seccion:'B'}];
 s.c.base=s.roster(students);s.run("bdEstudiantes=base;store.finales[finalKey('Resuelve','id:42')]={nivel:'AD'};store.finales[finalKey('Resuelve','id:99')]={nivel:'B'}");
 const ws={'!ref':'A1:E5',A3:{v:'42'},B3:{v:'00099'},C3:{v:'Synthetic Other'},B4:{v:'00042'},C4:{v:'Synthetic Wrong'},C5:{v:'Synthetic Corrected'}};
 const wb={SheetNames:['MATE'],Sheets:{MATE:ws}},ctx={nivel:'secundaria',bim:'III',grado:4,seccion:'B',area:'Matemática'};
 s.c.XLSX={read:()=>wb,write:()=>new Uint8Array(),utils:{decode_range:()=>({s:{r:0},e:{r:4}}),encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1)}};
 s.c.Blob=Blob;s.c.atob=atob;s.c.URL={createObjectURL:()=> 'synthetic'};s.c.document.createElement=()=>({click(){}});
 s.c.ctxTpl=()=>ctx;s.c.areasDeNivel=()=>['Matemática'];s.c.COMPS_SIAGIE={'Matemática':['Resuelve']};
 s.c.areaDeHojaAdm=s.c.areaDeHojaSiagie=()=>({area:'Matemática',only:null});s.c.compsDeArea=()=>['Resuelve'];
 s.c.normNomAdm=s.c.normNomSiagie=s.c.IEStudentIdentity.normalizarNombre;
 s.c.fetchRegAula=async()=>[{area:'Matemática',payload:s.c.sliceRegistroArea()}];s.c.IEStudents.loadRoster=async b=>{assert.equal(b,'III');return s.c.base;};
 s.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,b64:Buffer.from('synthetic').toString('base64')})});
 s.c.CLOUD_API_URL='synthetic';s.c.informeSiagie=()=>({ok:true});s.c.getLoginSession=()=>({role:'admin'});s.c.siagieTplMeta=null;
 const names=file==='admin.html'?['letraDesdePayload','concDesdePayload','vaciarSiagieOficial']:['letraEnArea','concEnArea','rellenarSiagieExcel'];
 for(const name of names)s.run(extract(file,name));
 await s.c[names[2]]();assert.equal(ws.D3.v,'AD','ID must win over another matching code/name');assert.equal(ws.D4.v,'AD');assert.equal(ws.D5.v,'AD');
});
